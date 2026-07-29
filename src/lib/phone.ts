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
