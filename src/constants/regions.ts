/**
 * Partner / marketplace service regions → countries.
 *
 * Source: UN M49 geoscheme (UNSD), remapped onto Pharma Socii’s seven commercial
 * region labels. Country display names match the app’s existing picker vocabulary
 * (e.g. UK, UAE, Korea, Slovak Republic).
 *
 * Mapping notes:
 * - North America = Northern America + Mexico (common commercial / USMCA set)
 * - South America = South America + Central America + Caribbean (Latin America;
 *   there is no separate LATAM region in the product)
 * - Europe = UN Europe (Turkey is under Middle East)
 * - Asia Pacific = Eastern, South-eastern, Southern, and Central Asia
 * - Middle East = Western Asia (incl. Turkey + Caucasus)
 * - Africa = UN Africa (incl. North Africa / Egypt)
 * - Australia & Oceania = UN Oceania
 */

export const SERVICE_REGIONS: string[] = [
  "North America",
  "South America",
  "Europe",
  "Asia Pacific",
  "Middle East",
  "Africa",
  "Australia & Oceania",
];

export type ServiceRegion = (typeof SERVICE_REGIONS)[number];

export const REGION_COUNTRY_MAP: Record<string, string[]> = {
  "North America": ["Canada", "Mexico", "United States"],

  "South America": [
    // South America
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Ecuador",
    "Guyana",
    "Paraguay",
    "Peru",
    "Suriname",
    "Uruguay",
    "Venezuela",
    // Central America
    "Belize",
    "Costa Rica",
    "El Salvador",
    "Guatemala",
    "Honduras",
    "Nicaragua",
    "Panama",
    // Caribbean
    "Barbados",
    "Cuba",
    "Dominican Republic",
    "Haiti",
    "Jamaica",
    "Trinidad and Tobago",
  ],

  Europe: [
    "Albania",
    "Andorra",
    "Austria",
    "Belarus",
    "Belgium",
    "Bosnia",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Iceland",
    "Ireland",
    "Italy",
    "Kosovo",
    "Latvia",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Moldova",
    "Monaco",
    "Montenegro",
    "Netherlands",
    "North Macedonia",
    "Norway",
    "Poland",
    "Portugal",
    "Romania",
    "Russia",
    "San Marino",
    "Serbia",
    "Slovak Republic",
    "Slovenia",
    "Spain",
    "Sweden",
    "Switzerland",
    "UK",
    "Ukraine",
    "Vatican City",
  ],

  "Asia Pacific": [
    // Eastern Asia
    "China",
    "Hong Kong",
    "Japan",
    "Korea",
    "Mongolia",
    "Taiwan",
    // South-eastern Asia
    "Brunei",
    "Cambodia",
    "Indonesia",
    "Laos",
    "Malaysia",
    "Myanmar",
    "Philippines",
    "Singapore",
    "Thailand",
    "Vietnam",
    // Southern Asia
    "Afghanistan",
    "Bangladesh",
    "Bhutan",
    "India",
    "Maldives",
    "Nepal",
    "Pakistan",
    "Sri Lanka",
    // Central Asia
    "Kazakhstan",
    "Kyrgyzstan",
    "Tajikistan",
    "Turkmenistan",
    "Uzbekistan",
  ],

  "Middle East": [
    "Armenia",
    "Azerbaijan",
    "Bahrain",
    "Georgia",
    "Iran",
    "Iraq",
    "Israel",
    "Jordan",
    "Kuwait",
    "Lebanon",
    "Oman",
    "Palestine",
    "Qatar",
    "Saudi Arabia",
    "Syria",
    "Turkey",
    "UAE",
    "Yemen",
  ],

  Africa: [
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Cape Verde",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Congo",
    "Djibouti",
    "Egypt",
    "Equatorial Guinea",
    "Eritrea",
    "Eswatini",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Ivory Coast",
    "Kenya",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mauritius",
    "Morocco",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Rwanda",
    "Sao Tome and Principe",
    "Senegal",
    "Seychelles",
    "Sierra Leone",
    "Somalia",
    "South Africa",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Togo",
    "Tunisia",
    "Uganda",
    "Zambia",
    "Zimbabwe",
  ],

  "Australia & Oceania": [
    "Australia",
    "Fiji",
    "Kiribati",
    "Marshall Islands",
    "Micronesia",
    "Nauru",
    "New Zealand",
    "Palau",
    "Papua New Guinea",
    "Samoa",
    "Solomon Islands",
    "Tonga",
    "Tuvalu",
    "Vanuatu",
  ],
};

/** Sorted unique country list derived from the region map (keeps picker ↔ preload in sync). */
export const SERVICE_COUNTRIES: string[] = Array.from(
  new Set(Object.values(REGION_COUNTRY_MAP).flat())
).sort((a, b) => a.localeCompare(b));

/** Countries for one or more selected regions (deduped, sorted). */
export function countriesForRegions(regions: string[]): string[] {
  const set = new Set<string>();
  for (const region of regions) {
    const list = REGION_COUNTRY_MAP[region];
    if (list) list.forEach((c) => set.add(c));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
