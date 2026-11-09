import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound transactional email. Ports Spring's `JavaMailSender` configuration from
 * `application.yaml`: Gmail SMTP on 587 with STARTTLS, authenticating as `MAIL_USERNAME`.
 *
 * The From address is deliberately separate from the SMTP login. `no-reply@voxlae.com` is a
 * Workspace *alias* of the real account — aliases have no login of their own, so SMTP must
 * authenticate as `MAIL_USERNAME` while the message still shows `MAIL_FROM`. Collapsing the two
 * would make Gmail reject the send.
 */

const SMTP_HOST = process.env.MAIL_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.MAIL_PORT ?? 587);

/**
 * Whether email is actually sent. Mirrors Spring's `app.otp.dev-mode`, which defaulted to `false`
 * in production and, when true, logged the code instead of mailing it.
 *
 * Derived from the absence of credentials rather than a separate flag, so a local checkout with no
 * `MAIL_PASSWORD` degrades to logging instead of throwing on every signup.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD);
}

let cached: Transporter | null = null;

/**
 * One transporter per process, reused across invocations.
 *
 * On a serverless platform a warm container keeps this alive, which is worth having: a fresh SMTP
 * connection costs a TLS handshake plus AUTH, and Gmail is slow enough at both that doing it per
 * request shows up in signup latency. A cold start simply rebuilds it.
 */
function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 587 is STARTTLS, so the connection starts plaintext and upgrades — `secure` must be false
    // here. Setting it true would make nodemailer expect implicit TLS and hang until timeout.
    secure: SMTP_PORT === 465,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
  });
  return cached;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body; `text` is always sent too, as the fallback clients without HTML show. */
  html?: string;
}

/**
 * Send, or log when unconfigured. Never throws.
 *
 * Swallowing the error is intentional and matches the Java: a failed OTP email must not fail the
 * signup request, because the user has already been created and the alternative is a half-finished
 * account with a 500 and no way to retry. The caller offers "resend code" for exactly this case.
 * The failure is logged with the code so a dev can still get through.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    console.info(
      `[mailer] SMTP not configured — would have sent to ${mail.to}: ${mail.subject}\n${mail.text}`,
    );
    return false;
  }
  try {
    await transporter().sendMail({
      from: process.env.MAIL_FROM ?? "no-reply@voxlae.com",
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
    });
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[mailer] send to ${mail.to} failed: ${reason}\n${mail.text}`);
    return false;
  }
}
