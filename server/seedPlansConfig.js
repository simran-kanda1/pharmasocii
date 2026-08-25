import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
    const envPath = resolve(__dirname, ".env");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...rest] = trimmed.split("=");
            process.env[key.trim()] = rest.join("=").trim();
        }
    }
} catch { /* no .env file, use defaults */ }

try {
    const serviceAccountPath = resolve(__dirname, "pharmasocii_admin.json");
    if (existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: "pharmasocii"
        });
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: "pharmasocii"
        });
    }
} catch (e) {
    console.error("Firebase Admin failed to initialize.", e.message);
    process.exit(1);
}

const db = admin.firestore();

const seedData = {
    groups: [
        {
            id: "business_offerings",
            title: "Business Offerings and Consulting",
            hasAnnualToggle: true,
            order: 1,
            plans: [
                {
                    id: "basic",
                    badge: "Basic",
                    subtitle: "Individuals or businesses getting started.",
                    monthlyPrice: 100,
                    yearlyMonthlyPrice: 90,
                    yearlyTotalPrice: 1080,
                    features: [
                        "Access to specialized categories — list up to 3",
                        "List primary service country — 1",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Certifications (optional) — highlight relevant certifications",
                        "Biosafety level (optional) — BSL disclosure"
                    ],
                    isFeatured: false,
                    maxCategories: 3,
                    maxCountries: 1,
                    stripeMonthlyId: "basic_mo",
                    stripeYearlyId: "basic_yr",
                    tierRank: 1
                },
                {
                    id: "standard",
                    badge: "Standard",
                    subtitle: "Individuals or businesses providing services in more than one country.",
                    monthlyPrice: 200,
                    yearlyMonthlyPrice: 182,
                    yearlyTotalPrice: 2184,
                    features: [
                        "Access to specialized categories — list up to 5",
                        "List primary service countries — up to 3",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Certifications (optional) — highlight relevant certifications",
                        "Biosafety level (optional) — BSL disclosure"
                    ],
                    isFeatured: false,
                    maxCategories: 5,
                    maxCountries: 3,
                    stripeMonthlyId: "standard_mo",
                    stripeYearlyId: "standard_yr",
                    tierRank: 2
                },
                {
                    id: "premium",
                    badge: "Premium",
                    subtitle: "Businesses with a broader scope and presence",
                    monthlyPrice: 400,
                    yearlyMonthlyPrice: 360,
                    yearlyTotalPrice: 4320,
                    features: [
                        "Access to specialized categories — list up to 15",
                        "List primary service countries — up to 15",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Option to highlight certifications",
                        "Optional BSL (Biosafety Level) disclosure"
                    ],
                    isFeatured: true,
                    maxCategories: 15,
                    maxCountries: 15,
                    stripeMonthlyId: "premium_mo",
                    stripeYearlyId: "premium_yr",
                    tierRank: 3
                },
                {
                    id: "premium_plus",
                    badge: "Premium Plus",
                    subtitle: "Businesses with a global presence",
                    monthlyPrice: 1000,
                    yearlyMonthlyPrice: 900,
                    yearlyTotalPrice: 10800,
                    features: [
                        "Access to specialized categories — Unlimited",
                        "List primary service countries — Unlimited",
                        "Company profile to highlight your key offerings",
                        "Display your logo for branding",
                        "Direct website link",
                        "Add representative(s) for direct communication",
                        "Option to highlight certifications",
                        "Optional BSL (Biosafety Level) disclosure",
                        "Extra Feature: Homepage spotlight for increased visibility"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "premium_plus_mo",
                    stripeYearlyId: "premium_plus_yr",
                    tierRank: 4
                }
            ]
        },
        {
            id: "events",
            title: "Events & Conferences",
            hasAnnualToggle: false,
            order: 2,
            plans: [
                {
                    id: "event_basic",
                    badge: "Basic",
                    subtitle: "Single day conference/event",
                    monthlyPrice: 500,
                    yearlyMonthlyPrice: 500,
                    yearlyTotalPrice: 500,
                    features: [
                        "Event profile",
                        "Agenda highlights (500 chars) + full agenda PDF",
                        "Event date (single day)",
                        "Event location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "basic_event",
                    tierRank: 1
                },
                {
                    id: "event_standard",
                    badge: "Standard",
                    subtitle: "Multi day conference/event",
                    monthlyPrice: 850,
                    yearlyMonthlyPrice: 850,
                    yearlyTotalPrice: 850,
                    features: [
                        "Event profile",
                        "Agenda highlights (500 chars) + full agenda PDF",
                        "Multi-day event dates",
                        "Event location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "standard_event",
                    tierRank: 2
                },
                {
                    id: "event_premium",
                    badge: "Premium",
                    subtitle: "Single or multi-day conference/event",
                    monthlyPrice: 1250,
                    yearlyMonthlyPrice: 1250,
                    yearlyTotalPrice: 1250,
                    features: [
                        "Extra Feature: Landing page spotlight for increased visibility",
                        "Event profile",
                        "Agenda highlights (500 chars) + full agenda PDF",
                        "Multi-day event dates",
                        "Event location",
                        "Select multiple categories for better visibility",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: true,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "premium_event",
                    tierRank: 3
                },
                {
                    id: "event_premium_plus",
                    badge: "Premium Plus",
                    subtitle: "Single or multi-day conference/event",
                    monthlyPrice: 1450,
                    yearlyMonthlyPrice: 1450,
                    yearlyTotalPrice: 1450,
                    features: [
                        "Extra Feature: Home page spotlight for maximum visibility",
                        "Event profile",
                        "Agenda highlights (500 chars) + full agenda PDF",
                        "Multi-day event dates",
                        "Event location",
                        "Select multiple categories",
                        "Company profile",
                        "Display your logo for branding",
                        "Direct link to your site for easy sign up",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "premium_plus_event",
                    tierRank: 4
                }
            ]
        },
        {
            id: "jobs",
            title: "Jobs",
            hasAnnualToggle: false,
            order: 3,
            plans: [
                {
                    id: "job_standard",
                    badge: "Standard",
                    subtitle: "Standard Job Listing",
                    monthlyPrice: 400,
                    yearlyMonthlyPrice: 400,
                    yearlyTotalPrice: 400,
                    features: [
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "standard_job",
                    tierRank: 1
                },
                {
                    id: "job_premium",
                    badge: "Premium",
                    subtitle: "Premium Job Listing",
                    monthlyPrice: 800,
                    yearlyMonthlyPrice: 800,
                    yearlyTotalPrice: 800,
                    features: [
                        "Extra Feature: Landing page spotlight for increased visibility",
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: true,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "premium_job",
                    tierRank: 2
                },
                {
                    id: "job_premium_plus",
                    badge: "Premium Plus",
                    subtitle: "Premium Plus Job Listing",
                    monthlyPrice: 1000,
                    yearlyMonthlyPrice: 1000,
                    yearlyTotalPrice: 1000,
                    features: [
                        "Extra Feature: Home page spotlight for maximum visibility",
                        "Position title for quick search",
                        "Job description outlining key responsibilities",
                        "Company profile to showcase your brand and attract top talent",
                        "Direct link to your site for easy applications",
                        "Display your logo for branding",
                        "Location for filtering and relevance",
                        "Industry classification to improve discoverability",
                        "Add representative(s) for direct communication"
                    ],
                    isFeatured: false,
                    maxCategories: -1,
                    maxCountries: -1,
                    stripeMonthlyId: "premium_plus_job",
                    tierRank: 3
                }
            ]
        }
    ]
};

async function run() {
    try {
        await db.collection("config").doc("plansConfig").set(seedData);
        console.log("Successfully seeded plansConfig");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
