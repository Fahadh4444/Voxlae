/**
 * Reference data for profile forms — suggestion lists and presets.
 *
 * These are *suggestions*, never restrictions: every field that uses them also
 * accepts free text, so we're not blocking someone whose city, language or tool
 * isn't on our list.
 *
 * Kept client-side deliberately: no API key, no network call, no CSP hassle,
 * and suggestions appear instantly as the user types.
 */

/**
 * Common cities, India-weighted (our first market) then major global hubs.
 *
 * These are a shortcut, not a whitelist — every location field accepts free text,
 * so a town that isn't listed still works. We deliberately include tier-2/tier-3
 * Indian towns (not just metros) because that's where a lot of our creators are.
 */
export const CITY_SUGGESTIONS: string[] = [
  // India — metros
  'Bengaluru, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India',
  'Chennai, India', 'Pune, India', 'Kolkata, India', 'Ahmedabad, India',
  'Jaipur, India', 'Kochi, India', 'Chandigarh, India', 'Indore, India',
  'Lucknow, India', 'Coimbatore, India', 'Thiruvananthapuram, India',
  'Bhopal, India', 'Nagpur, India', 'Surat, India', 'Visakhapatnam, India',
  'Guwahati, India', 'Bhubaneswar, India', 'Goa, India',
  // India — tier-2 / tier-3 cities & towns
  'Mysuru, India', 'Mangaluru, India', 'Hubli, India', 'Belagavi, India',
  'Kozhikode, India', 'Thrissur, India', 'Kollam, India', 'Kannur, India',
  'Kottayam, India', 'Alappuzha, India', 'Palakkad, India', 'Malappuram, India',
  'Madurai, India', 'Tiruchirappalli, India', 'Salem, India', 'Erode, India',
  'Tirunelveli, India', 'Vellore, India', 'Tirupur, India', 'Puducherry, India',
  'Vijayawada, India', 'Guntur, India', 'Tirupati, India', 'Nellore, India',
  'Warangal, India', 'Rajahmundry, India',
  'Nashik, India', 'Aurangabad, India', 'Nagercoil, India', 'Kolhapur, India',
  'Solapur, India', 'Amravati, India', 'Vadodara, India', 'Rajkot, India',
  'Bhavnagar, India', 'Jamnagar, India', 'Gandhinagar, India',
  'Udaipur, India', 'Jodhpur, India', 'Kota, India', 'Ajmer, India', 'Bikaner, India',
  'Kanpur, India', 'Agra, India', 'Varanasi, India', 'Prayagraj, India',
  'Meerut, India', 'Noida, India', 'Ghaziabad, India', 'Gurugram, India',
  'Faridabad, India', 'Aligarh, India', 'Bareilly, India', 'Gorakhpur, India',
  'Dehradun, India', 'Haridwar, India', 'Rishikesh, India', 'Shimla, India',
  'Jammu, India', 'Srinagar, India', 'Amritsar, India', 'Ludhiana, India',
  'Jalandhar, India', 'Patiala, India', 'Mohali, India',
  'Patna, India', 'Ranchi, India', 'Jamshedpur, India', 'Dhanbad, India',
  'Raipur, India', 'Bilaspur, India', 'Jabalpur, India', 'Gwalior, India',
  'Ujjain, India', 'Siliguri, India', 'Durgapur, India', 'Asansol, India',
  'Cuttack, India', 'Rourkela, India', 'Dispur, India', 'Imphal, India',
  'Shillong, India', 'Agartala, India', 'Aizawl, India', 'Itanagar, India',
  'Gangtok, India', 'Dibrugarh, India',
  // Asia-Pacific
  'Singapore', 'Dubai, UAE', 'Abu Dhabi, UAE', 'Doha, Qatar', 'Riyadh, Saudi Arabia',
  'Tokyo, Japan', 'Seoul, South Korea', 'Hong Kong', 'Shanghai, China',
  'Bangkok, Thailand', 'Jakarta, Indonesia', 'Kuala Lumpur, Malaysia',
  'Manila, Philippines', 'Ho Chi Minh City, Vietnam', 'Colombo, Sri Lanka',
  'Dhaka, Bangladesh', 'Karachi, Pakistan', 'Lahore, Pakistan',
  'Sydney, Australia', 'Melbourne, Australia', 'Auckland, New Zealand',
  // Europe
  'London, UK', 'Manchester, UK', 'Dublin, Ireland', 'Paris, France',
  'Berlin, Germany', 'Munich, Germany', 'Amsterdam, Netherlands',
  'Madrid, Spain', 'Barcelona, Spain', 'Lisbon, Portugal', 'Rome, Italy',
  'Milan, Italy', 'Zurich, Switzerland', 'Vienna, Austria', 'Prague, Czechia',
  'Warsaw, Poland', 'Stockholm, Sweden', 'Copenhagen, Denmark', 'Oslo, Norway',
  'Helsinki, Finland', 'Istanbul, Turkey',
  // Americas
  'New York, USA', 'Los Angeles, USA', 'San Francisco, USA', 'Seattle, USA',
  'Austin, USA', 'Chicago, USA', 'Miami, USA', 'Boston, USA',
  'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'Mexico City, Mexico', 'São Paulo, Brazil', 'Buenos Aires, Argentina',
  'Bogotá, Colombia', 'Santiago, Chile',
  // Africa
  'Lagos, Nigeria', 'Nairobi, Kenya', 'Cairo, Egypt', 'Cape Town, South Africa',
  'Johannesburg, South Africa', 'Accra, Ghana',
  // Remote
  'Remote',
];

/** Languages, India-weighted then widely-used world languages. */
export const LANGUAGE_SUGGESTIONS: string[] = [
  'English', 'Hindi', 'Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Marathi',
  'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Assamese',
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Russian',
  'Arabic', 'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Vietnamese',
  'Thai', 'Indonesian', 'Turkish', 'Polish', 'Swedish', 'Filipino', 'Swahili',
];

/** Tools/software, grouped by the work creators actually hire for. */
export const TOOL_SUGGESTIONS: string[] = [
  // Video
  'Adobe Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'CapCut',
  'Adobe After Effects', 'Filmora', 'iMovie', 'Descript', 'Camtasia',
  // Design
  'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Canva', 'Adobe XD',
  'Sketch', 'Affinity Designer', 'Blender', 'Cinema 4D',
  // Audio
  'Adobe Audition', 'Audacity', 'Logic Pro', 'Ableton Live', 'FL Studio',
  // Writing / content
  'Notion', 'Google Docs', 'Grammarly', 'Jasper',
  // Social / analytics
  'Later', 'Buffer', 'Hootsuite', 'Metricool', 'Google Analytics',
  'YouTube Studio', 'Meta Business Suite', 'TubeBuddy', 'vidIQ',
  // Dev / other
  'WordPress', 'Webflow', 'Shopify', 'Framer',
];

/** Currencies offered for rates (symbol used for display). */
export const CURRENCIES: Array<{ code: string; symbol: string; label: string }> = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AED', symbol: 'AED ', label: 'AED' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
];

export type RateUnit = 'HOUR' | 'DAY' | 'PROJECT';

export const RATE_UNITS: Array<{ value: RateUnit; label: string; short: string }> = [
  { value: 'HOUR', label: 'per hour', short: 'hr' },
  { value: 'DAY', label: 'per day', short: 'day' },
  { value: 'PROJECT', label: 'per project', short: 'project' },
];

/**
 * Suggested rate amounts, by currency. Rupee-denominated work sits at very
 * different absolute numbers from dollar work, so a single ladder would be
 * useless for one of them.
 */
export const RATE_PRESETS: Record<string, number[]> = {
  INR: [300, 500, 800, 1000, 1500, 2000, 3000, 5000],
  USD: [10, 15, 25, 35, 50, 75, 100, 150],
  EUR: [10, 15, 25, 35, 50, 75, 100, 150],
  GBP: [10, 15, 25, 35, 50, 75, 100, 150],
  AED: [40, 60, 90, 130, 180, 275, 350, 550],
  SGD: [15, 20, 35, 50, 70, 100, 140, 200],
  AUD: [15, 25, 40, 55, 75, 110, 150, 220],
  CAD: [15, 20, 35, 50, 70, 100, 140, 200],
};

export const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find(c => c.code === code)?.symbol ?? '';

/** "₹1,500 per hour" — the one place rate display is defined. */
export const formatRate = (
  amount?: number | string | null,
  currency?: string | null,
  unit?: string | null
): string | null => {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return null;

  const symbol = currencySymbol(currency);
  const pretty = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const unitLabel = RATE_UNITS.find(u => u.value === unit)?.label ?? '';
  return `${symbol}${pretty}${unitLabel ? ` ${unitLabel}` : ''}`.trim();
};

// ── Influencer setup (role wizard) ──────────────────────────────

/** Content niches — suggestions for the influencer setup (free text allowed). */
export const NICHE_SUGGESTIONS: string[] = [
  'Technology', 'Gaming', 'Fitness & Health', 'Beauty & Makeup', 'Fashion',
  'Food & Cooking', 'Travel', 'Finance & Investing', 'Business & Startups',
  'Education', 'Comedy & Entertainment', 'Music', 'Art & Design',
  'Photography', 'Film & Video', 'Lifestyle', 'Parenting', 'Sports',
  'Automotive', 'Home & DIY', 'Books & Writing', 'Science', 'News & Politics',
  'Spirituality', 'Pets & Animals', 'Productivity', 'Coding & Development',
];

export interface OptionItem { value: string; label: string; description?: string; icon?: string; }

// ── Brand setup ─────────────────────────────────────────────────

export const COMPANY_SIZES: string[] = [
  'Just me', '2–10', '11–50', '51–200', '201–500', '500+',
];

export const INDUSTRY_SUGGESTIONS: string[] = [
  'Technology', 'E-commerce', 'Fashion & Apparel', 'Beauty & Cosmetics',
  'Food & Beverage', 'Health & Wellness', 'Finance', 'Gaming', 'Travel & Hospitality',
  'Education', 'Media & Entertainment', 'Automotive', 'Real Estate', 'SaaS',
  'Consumer Electronics', 'Fitness', 'Home & Living', 'Non-profit',
];
