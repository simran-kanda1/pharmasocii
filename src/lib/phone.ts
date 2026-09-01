import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalize a stored or typed phone string for react-phone-number-input.
 * Accepts values with or without a leading "+", and national numbers
 * (e.g. area code without country code) using defaultCountry.
 */
export function toPhoneInputValue(
  raw: string | null | undefined,
  defaultCountry: CountryCode = "US",
): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  const asE164 = (value: string, country?: CountryCode): string | null => {
    try {
      const parsed = country
        ? parsePhoneNumberFromString(value, country)
        : parsePhoneNumberFromString(value);
      return parsed?.number || null;
    } catch {
      return null;
    }
  };

  if (s.startsWith("+")) {
    return asE164(s) || s;
  }

  // National number with default country (e.g. 6475551234 → +1…)
  const asNational = asE164(s, defaultCountry);
  if (asNational) return asNational;

  // Country code typed without "+' (e.g. 16475551234)
  const digits = s.replace(/\D/g, "");
  if (digits) {
    const withPlus = asE164(`+${digits}`);
    if (withPlus) return withPlus;
    const nationalDigits = asE164(digits, defaultCountry);
    if (nationalDigits) return nationalDigits;
    return `+${digits}`;
  }

  return s;
}

/**
 * Check if a phone string has enough digits to be considered a real phone number
 * (not just an empty country code like "+1").
 */
export function isCompletePhoneNumber(raw: string | null | undefined): boolean {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 7;
}

const CODE_TO_SERVICE_COUNTRY: Record<string, string> = {
  CA: "Canada",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IN: "India",
  CH: "Switzerland",
  JP: "Japan",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  SE: "Sweden",
  DK: "Denmark",
  NO: "Norway",
  FI: "Finland",
  IE: "Ireland",
  AT: "Austria",
  NZ: "New Zealand",
  SG: "Singapore",
  BR: "Brazil",
  MX: "Mexico",
  IL: "Israel",
  KR: "Korea",
  CN: "China",
  ZA: "South Africa",
  AE: "UAE",
};

export function getServiceCountryFromPhone(raw: string | null | undefined): string | null {
  try {
    const s = String(raw || "").trim();
    if (!s) return null;
    const parsed = parsePhoneNumberFromString(s.startsWith("+") ? s : `+${s}`);
    if (parsed?.country && CODE_TO_SERVICE_COUNTRY[parsed.country]) {
      return CODE_TO_SERVICE_COUNTRY[parsed.country];
    }
    return null;
  } catch {
    return null;
  }
}
