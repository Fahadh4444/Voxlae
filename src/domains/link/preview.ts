import dns from "node:dns/promises";
import net from "node:net";

/**
 * Open Graph metadata for a user-supplied URL. Ports `LinkPreviewService`.
 *
 * **This makes the server fetch a URL the caller chose, which is a textbook SSRF sink.** Everything
 * below exists to contain that:
 *
 *  - only `http`/`https` — no `file:`, `data:`, `gopher:`
 *  - every hop (the initial URL **and each redirect**) is re-resolved and IP-checked; redirects are
 *    followed manually so a 302 cannot smuggle the fetch to `169.254.169.254`
 *  - loopback, private, link-local, CGNAT and cloud-metadata addresses are refused
 *  - **the extracted `og:image` URL is validated with the same rules.** This is the exact hole that
 *    bit Lemmy (GHSA-h6hf-9846-xwrq), where the page URL was checked and the image URL was not,
 *    leaking internal endpoints through the *browser* that later loaded it
 *  - short timeouts and a hard read cap, so a slow or huge response cannot tie up a function
 *
 * **One limitation carried over unchanged from the Java, worth stating rather than implying it is
 * solved:** validating DNS and then calling `fetch` re-resolves the hostname, so a DNS-rebinding
 * attacker who returns a public address on the first lookup and a private one on the second can still
 * get through. Closing that needs pinning the connection to the validated IP, which neither
 * `HttpURLConnection` nor `fetch` exposes. The endpoint is authenticated, which is the mitigation
 * that actually applies — it is not an anonymous internet-facing probe.
 */

const CONNECT_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
/** Only `<head>` matters, so cap the read — a huge body must not exhaust the function's memory. */
const MAX_BYTES = 256 * 1024;
const USER_AGENT = "VoxlaeLinkPreview/1.0 (+https://voxlae.com)";

/**
 * Blocked address space, as explicit CIDRs.
 *
 * Built with `net.BlockList` rather than hand-rolled byte arithmetic (which is what the Java had to
 * do, lacking an equivalent). The ranges are the same set; naming each one makes it reviewable, and
 * it is the kind of code where an off-by-one in a bitmask is both easy and invisible.
 */
function blockList(): net.BlockList {
  const list = new net.BlockList();
  // IPv4
  list.addSubnet("0.0.0.0", 8, "ipv4"); // "this host on this network"
  list.addSubnet("10.0.0.0", 8, "ipv4"); // private
  list.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT / shared
  list.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
  list.addSubnet("169.254.0.0", 16, "ipv4"); // link-local — AWS/GCP/Azure metadata lives here
  list.addSubnet("172.16.0.0", 12, "ipv4"); // private
  list.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
  list.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1
  list.addSubnet("192.168.0.0", 16, "ipv4"); // private
  list.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
  list.addSubnet("198.51.100.0", 24, "ipv4"); // TEST-NET-2
  list.addSubnet("203.0.113.0", 24, "ipv4"); // TEST-NET-3
  list.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
  list.addSubnet("240.0.0.0", 4, "ipv4"); // reserved
  // IPv6
  list.addAddress("::", "ipv6"); // unspecified
  list.addAddress("::1", "ipv6"); // loopback
  list.addSubnet("fc00::", 7, "ipv6"); // unique local
  list.addSubnet("fe80::", 10, "ipv6"); // link-local
  list.addSubnet("ff00::", 8, "ipv6"); // multicast
  /**
   * Deliberately absent: `::ffff:0:0/96` (IPv4-mapped) and `64:ff9b::/96` (NAT64).
   *
   * Adding an IPv6 rule for `::ffff:0:0/96` **blocks every IPv4 address**, because Node normalises an
   * IPv4 argument to its IPv4-mapped form before comparing — so `check("104.20.23.154", "ipv4")`
   * matches the /96 and returns true. Verified; it silently broke every preview.
   *
   * Blocking `64:ff9b::/96` outright breaks IPv6-only networks, where public IPv4 hosts legitimately
   * arrive as NAT64 addresses. Both are instead handled in `isBlocked` by extracting the embedded
   * IPv4 and checking *that* against the IPv4 rules, which is the actual question in both cases.
   */
  return list;
}

const BLOCKED = blockList();

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/**
 * Parse and refuse anything that is not http(s) pointing at a public address.
 *
 * DNS is resolved here so an internal target is rejected *before* any connection is opened. **Every**
 * address the host resolves to must be public — a hostname can carry several records, and one
 * internal record is enough to be dangerous.
 */
async function safeUrl(candidate: string | null | undefined): Promise<URL | null> {
  if (!candidate?.trim()) return null;

  let url: URL;
  try {
    url = new URL(candidate.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;

  // A literal IP in the URL never reaches DNS, so check it directly.
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(literal)) {
    return isBlocked(literal) ? null : url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(literal, { all: true });
  } catch {
    return null;
  }
  if (addresses.length === 0) return null;
  for (const { address } of addresses) {
    if (isBlocked(address)) {
      console.warn(`[link-preview] blocked non-public address: ${literal} -> ${address}`);
      return null;
    }
  }
  return url;
}

/**
 * The last 32 bits of an IPv6 address as dotted-quad, for the two prefixes that embed an IPv4 address:
 * `::ffff:a.b.c.d` (IPv4-mapped) and `64:ff9b::a.b.c.d` (NAT64).
 *
 * Both can be written either with the trailing dotted-quad or as plain hex groups — `::ffff:10.0.0.1`
 * and `::ffff:a00:1` are the same address, and `dns.lookup` returns whichever form the resolver used.
 * Matching only the dotted-quad spelling would let the hex spelling straight through, which is the
 * kind of bypass that looks like a typo in a regex.
 */
function embeddedIPv4(address: string): string | null {
  const lower = address.toLowerCase();
  const prefix = lower.startsWith("::ffff:")
    ? "::ffff:"
    : lower.startsWith("64:ff9b::")
      ? "64:ff9b::"
      : null;
  if (!prefix) return null;

  const tail = lower.slice(prefix.length);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(tail)) return tail;

  // Hex form: up to two groups holding the high and low 16 bits.
  const groups = tail.split(":").filter(Boolean);
  if (groups.length === 0 || groups.length > 2 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) {
    return null;
  }
  const [high, low] = groups.length === 2 ? groups : ["0", groups[0]];
  const value = (parseInt(high, 16) << 16) | parseInt(low, 16);
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(".");
}

function isBlocked(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return BLOCKED.check(address, "ipv4");
  if (version === 6) {
    if (BLOCKED.check(address, "ipv6")) return true;
    // An address that embeds an IPv4 one is re-checked against the IPv4 rules, or the whole
    // private-range list is bypassed simply by writing the address the other way round.
    const embedded = embeddedIPv4(address);
    if (embedded) return BLOCKED.check(embedded, "ipv4");
    return false;
  }
  return true; // unparseable — refuse
}

interface FetchResult {
  finalUrl: URL;
  body: string;
}

/** Fetch HTML, following redirects manually so every hop goes back through `safeUrl`. */
async function fetchHtml(start: URL): Promise<FetchResult | null> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        // `manual` is the whole point: letting fetch follow redirects would skip the SSRF check on
        // every hop after the first, which is the easiest way to defeat this guard.
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return null;
      }
      const checked = await safeUrl(next.toString());
      if (!checked) {
        console.warn(`[link-preview] blocked redirect to unsafe target: ${location}`);
        return null;
      }
      current = checked;
      continue;
    }

    if (response.status !== 200) return null;

    const contentType = response.headers.get("content-type");
    // Images and PDFs have no OG tags to read, so there is nothing to gain from downloading them.
    if (contentType && !contentType.toLowerCase().includes("html")) return null;

    return { finalUrl: current, body: await readCapped(response) };
  }
  return null; // too many redirects
}

/**
 * Read at most `MAX_BYTES`, then stop.
 *
 * Streamed and cancelled rather than `await response.text()`: the cap has to apply to what is
 * actually transferred. Reading the whole body and truncating afterwards means a 2GB response still
 * gets downloaded first, which is the denial-of-service this is meant to prevent.
 */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8");
}

// ==================== PARSE ====================

const META_TAG = /<meta\s+[^>]*>/gi;
const PROP_ATTR = /(?:property|name)\s*=\s*["']([^"']+)["']/i;
const CONTENT_ATTR = /content\s*=\s*["']([^"']*)["']/i;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

/**
 * Regex rather than an HTML parser, matching the Java.
 *
 * Deliberate: the input is untrusted remote HTML read up to a byte cap, so it is frequently truncated
 * mid-tag. A real parser either throws or tries to repair it; a regex over `<meta>` tags finds what is
 * there and ignores the rest, which is the behaviour that suits a best-effort preview.
 */
function ogTag(html: string, property: string): string | null {
  for (const match of html.matchAll(META_TAG)) {
    const tag = match[0];
    const prop = PROP_ATTR.exec(tag);
    if (prop && prop[1].toLowerCase() === property.toLowerCase()) {
      const content = CONTENT_ATTR.exec(tag);
      if (content) return decode(content[1]);
    }
  }
  return null;
}

function htmlTitle(html: string): string | null {
  const match = TITLE_TAG.exec(html);
  return match ? decode(match[1].trim()) : null;
}

function decode(value: string | null): string | null {
  if (value == null) return null;
  const out = value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return out ? out : null;
}

function firstNonBlank(...values: (string | null)[]): string | null {
  for (const value of values) if (value?.trim()) return value;
  return null;
}

function truncate(value: string | null, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
}

/** Resolve OG metadata. Returns null if the URL is unsafe, unreachable, or not HTML. */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const url = await safeUrl(rawUrl);
  if (!url) return null;

  try {
    const result = await fetchHtml(url);
    if (!result) return null;

    const { body: html, finalUrl } = result;

    // The image is loaded by the *browser*, not by us — but handing back a URL that points at our
    // internal network would make the browser the probe. Same guard, no exceptions.
    const rawImage = ogTag(html, "og:image");
    let image: string | null = null;
    if (rawImage) {
      try {
        const checked = await safeUrl(new URL(rawImage, finalUrl).toString());
        image = checked?.toString() ?? null;
      } catch {
        image = null;
      }
    }

    const title = firstNonBlank(ogTag(html, "og:title"), htmlTitle(html));
    const description = firstNonBlank(ogTag(html, "og:description"), ogTag(html, "description"));
    const siteName = firstNonBlank(ogTag(html, "og:site_name"), finalUrl.hostname);

    if (!title && !description && !image) return null; // nothing worth showing

    return {
      url: finalUrl.toString(),
      title: truncate(title, 300),
      description: truncate(description, 600),
      image,
      siteName: truncate(siteName, 120),
    };
  } catch (error) {
    console.debug(
      `[link-preview] failed for ${rawUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
