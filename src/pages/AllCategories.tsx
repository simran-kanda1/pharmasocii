import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Building2, Users, Search, ExternalLink, Calendar, Briefcase, X, ChevronRight, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const BUSINESS_CATEGORIES: Record<string, string[]> = {
    "Artificial Intelligence & Bioinformatics": [],
    "Automation": [
        "Equipment", "Facility", "Laboratory Systems", "Manufacturing", "Other",
        "Packaging", "Process Analytical Technologies", "Warehouse"
    ],
    "Building Systems & Controls": [],
    "Buildings & Used Equipment": [
        "GMP Space", "Lab Space", "Non-GMP Space", "Used Equipment"
    ],
    "Cell & Virus Banks": [
        "Characterization", "Creation", "Cryopreservation", "DNA Sizing & Barcoding",
        "Genetic Stability", "Qualification", "Release testing", "Storage"
    ],
    "Cleaning Agents": [],
    "Cleaning Services": [],
    "Clinical & Diagnostic Testing": [
        "Blood", "Compartmental Specimens", "Donor", "Genetics", "HLA Typing",
        "Molecular Specimens", "Plasma", "Serum", "Tissues"
    ],
    "Clinical Research & Development": [],
    "Container Closures & Packaging": [
        "Adverse Event Management", "Animal Research Centers", "Audits", "Biobanking & Storage", "Biospecimen Services", "Biostats", "Contract Support", "Data Management", "Decentralized Trials", "End to End Pharmacovigilance System", "EU QPPV", "Lab & Analytical Services", "Literature Screening", "Local Contact Person", "Mice Models for Research", "Non-Human Primates for Research", "Other", "Patient Recruitment & Support", "Patient Support", "Pharmacovigilance", "Post Authorization Safety Studies", "Post Marketing Surveillance", "Pre-Clinical Studies", "Primate Models for Research", "Product Complaints Management", "Project Management", "Protocol Writing", "Real World Evidence", "Research Platforms", "Site Management", "Site Selection & Qualification", "Specialty Testing", "Target & Lead Optimization", "Translational Sciences", "Trial Planning & Management", "Vendor Management"
    ],
    "Digital Solutions For Life Sciences": [],
    "Engineering": [
        "Computer Systems", "Environmental Controls", "Equipment", "Facility", "Process", "Utilities", "Warehouse"
    ],
    "Environmental Monitoring & Testing": [],
    "Equipment": [
        "Auxiliary Equipment", "Building Systems", "Calibration", "Cleaning", "Drug Product Manufacturing & Filling", "Drug Substance Manufacturing", "Laboratory", "Maintenance & Repair", "Other", "Packaging", "Storage", "Warehouse", "Water Purification"
    ],
    "Facility Design And Qualifications": [
        "Drug Product Manufacturing", "Drug Substance Manufacturing", "Filling", "Laboratory", "Other", "Packaging", "Storage", "Utilities", "Warehouse", "Water Purification"
    ],
    "Facility Security": [],
    "Formulation Development": [],
    "Genomics & Related Services": [],
    "GMO Applications": [],
    "Gowning & Protective Equipment": [],
    "Import & Export Services": [],
    "In Country Agent": [],
    "Insilico Assessments": [],
    "Intellectual Property Services": [],
    "Labeling Design & Printing": [],
    "Laboratory & Related Services": [],
    "Manufacturers": [],
    "Material Sciences": [],
    "Materials/ Excipients / Cells": [
        "B Cells", "Biomedical Materials", "Buffers", "Cell Strains", "Chemicals", "Compendial Excipients", "Consumables", "Custom GMP Excipients", "Custom Media", "DC Cells", "Enzymes", "Expression Systems", "Gases", "Genes", "Hematopoietic Stem Cells", "Insect Cell Lines", "Lipids", "Mammalian Cells", "Media", "Microbial Cells", "MSC Cells", "NK Cells", "Non-Compendial Excipients", "Non-GMP Excipients", "Novel Excipients", "Nucleic Acids", "Oligos", "Other Materials", "Polymers", "Primary Human Cells", "Primers & Probes", "Process Reagents", "Proteins", "Raw Materials", "Solutions", "Solvents", "Specialty Materials", "Stem Cell Derived Lines", "Sterile Filters", "T cells (aβ, γδ, Treg)", "TIL Cells", "Tissue Cultures", "Yeast Cell Lines"
    ],
    "Medical Devices & Delivery Systems": [],
    "Medical Writing": [],
    "Non-Clinical Research/Related Activities": [],
    "Other": [],
    "Pest Control (GMP Facility)": [],
    "Pharmacology & Toxicology Studies": [],
    "Pre-Clinical Research": [],
    "Process Characterization Studies": [],
    "Process Development": [],
    "Project Management": [
        "Clinical", "CMC", "Equipment Installation & Qualification", "Facility Projects", "Non-Clinical", "Other"
    ],
    "QP Services": [],
    "Radiopharmaceuticals": [
        "Clinical Research", "Development", "Manufacturing", "Other", "Packaging", "Pre-Clinical Research", "Testing"
    ],
    "Regulatory Operations & Publishing": [],
    "Regulatory Services": [
        "Clinical writing", "CMC writing", "Non-clinical writing", "Other"
    ],
    "Shipping Services": [
        "≤ -20 ˚C", "≤ -60 ˚C", "2-8 ˚C", "Ambient", "Cold Chain Solutions", "Other", "Shipping Validation", "Specialty Services", "Temperature Mapping Studies"
    ],
    "Statistical Analysis": [],
    "Storage & Distribution": [
        "≤ -20 ˚C", "≤ -60 ˚C", "2-8 ˚C", "Ambient", "Cold Chain Solutions", "Other", "Specialty Services", "Temperature Mapping Studies"
    ],
    "Technical CMC Writing": [],
    "Technology Transfer": [],
    "Therapeutic Areas": [
        "Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Immuno-Oncology", "Men’s Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthalmology", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women’s Health"
    ],
    "Translational Sciences/Pre-Clinical Work": [],
    "Translations": [],
    "Validation & Qualification": [],
    "Virus Clearance Studies": [],
    "Water": [
        "Bacteriostatic", "Distilled", "GMP Manufacturing", "Medical Device Manufacturing", "Parenteral Formulation", "Purified", "Saline Solutions", "Sterile Water for Inhalation", "Sterile Water for Injection", "Sterile Water for Irrigation", "Sterile water for Ophthalmic Solutions/Use"
    ]
};

const CONSULTING_CATEGORIES: Record<string, string[]> = {
    "Advisory Board": [], "Analytical Comparability": [], "Analytical Methods": [], "Artificial Intelligence": [],
    "Asset Evaluation": [], "Auditing": [], "Automation": [], "Bioinformatics": [], "Biostatistics & Data Science": [],
    "Clinical Trials & Research": [], "Cold Chain Solutions": [], "Commercialization": [], "Compatibility (In-Use) Studies": [],
    "Consent Decree & Warning Letters": [], "Contract Manufacturing Site Management": [], "Contract Research Site Management": [],
    "Due Diligence": [], "Engineering": [], "Environmental Impact Assessments": [], "Environmental Monitoring & Testing": [],
    "Extractable & Leachable Studies": [], "Facility Design & Qualifications": [], "Facility Maintenance & Support": [],
    "Formulation Development": [], "Gene Editing Based Therapies": [], "Genomics": [], "Genomics & Related Services": [],
    "Global Sample Logistics": [], "GMO Applications": [], "GMP/GXP Training": [], "Import & Export Services": [],
    "In Country Representative": [], "In Country Testing": [], "Insilico Assessments": [], "Integrated Control Strategy": [],
    "Interim Functional Leadership": [], "Key Opinion Leaders": [], "Labeling & Translation": [], "Labeling Requirements & Design": [],
    "Legal/IP Services": [], "Lot Release Program": [], "Manufacturing Capacity Planning": [], "Material Qualification": [],
    "Material Sciences": [], "Medical Affairs": [], "Medical Devices": [], "Medical Devices In Vitro Diagnostics": [],
    "Medical Writing": [], "Microbial Control Strategy": [], "Other": [], "Personalized Medicines": [], "Pharmacology & Toxicology": [],
    "Pharmacovigilance": [], "Post Market Surveillance": [], "Process Characterization Studies": [], "Process Development": [],
    "Project & Program Management": [], "Quality & Compliance": [], "Quality Control": [], "Radiolabeled Materials": [],
    "Radiopharmaceuticals": [], "Reference Standards": [], "Regulatory Sciences": [], "Research & Development": [],
    "Risk Assessments": [], "Scientific Advisory": [], "Specialty Services": [], "Specification Assessment": [],
    "Stability Strategy": [], "Stability Studies": [], "Statistical Analysis": [], "Statistical Analysis CMC": [],
    "Sterile Filter Validation Or Qualification": [], "Supply Chain Solutions": [], "Target Selection": [],
    "Technical Writing": [], "Technology & Software": [], "Technology Transfer & Process Development": [],
    "Therapeutic Areas": [], "Translations": [], "Translators": [], "Validation": [], "Viral Safety & Clearance Studies": [],
    "Warehouse Controls": [], "Water Purification Systems": []
};

const EVENTS_CATEGORIES: Record<string, string[]> = {
    "AAPS (American Association Of Pharmaceutical Scientists)": [], "Advanced & Next Generation Therapies": [], "Analytical Development & Testing": [],
    "Analytical Methods": [], "Antibodies & Antibody Conjugates": [], "Artificial Intelligence, Bioinformatics & Technology": [], "Aseptic Technologies": [],
    "Bioassays": [], "Biomarkers & Diagnostics": [], "Biomaterials & Biodevices": [], "Biosimilars": [], "Biotechnology": [], "Bispecifics": [],
    "Building Systems & Controls": [], "CASSS": [], "Cell & Gene Therapy": [], "Chemistry Manufacturing & Controls (CMC)": [],
    "Clinical Research & Development": [], "Clinical Trials & Research": [], "Comparability": [], "Continuous Manufacturing/PAT/Real Time Quality": [],
    "Dermatology": [], "DIA (Drug Information Association)": [], "Diabetes & Cardiovascular Diseases": [], "Digital Innovation In Health Care": [],
    "Drug Discovery & Development": [], "Drug Safety": [], "Epidemiology": [], "Formulation & Drug Delivery": [], "Gastroenterology": [],
    "Gene Editing": [], "Genomics": [], "GMP Facilities": [], "Good Manufacturing Practices (GMPs)": [], "Health Care Conference": [],
    "Health Policy": [], "Health Technology Assessment": [], "Hematology": [], "Hepatology": [], "Higher Order Structure": [],
    "ICH Conferences": [], "Infectious Diseases": [], "Intellectual Property": [], "ISPE (International Society For Pharmaceutical Engineering)": [],
    "Labelling": [], "Laboratory Equipment": [], "Manufacturing & Technical Operations": [], "Manufacturing Equipment": [], "Market Access": [],
    "Marketing & Sales": [], "Mass Spectrometry": [], "Materials, Reagents & Excipients": [], "Medical Affairs": [], "Medical Devices": [],
    "Medical Equipment": [], "Medicinal & Pharmaceutical Chemistry": [], "Men's Health": [], "Metabolic & Endocrine": [],
    "Microbiology, Virology, Immunology & Infectious Diseases": [], "Molecular & Precision Medicine": [], "Nephrology": [],
    "Neurology & Psychiatry": [], "Nucleic Acid Based Therapies": [], "Oncology": [], "Other": [], "Patient Recruitment & Engagement": [],
    "Pediatrics": [], "Pharmaceutical Law": [], "Pharmaceutical Science": [], "Pharmaceuticals": [], "Pharmacology & Toxicology": [],
    "Potency Assays": [], "Pre-Clinical Research & Development": [], "Pricing & Health Technology": [], "Quality & Compliance": [],
    "Radiopharmaceuticals": [], "Rare Disease & Orphan Drug Products": [], "Regulations & Guidances": [], "Regulatory Affairs": [],
    "Research & Innovation": [], "Respiratory": [], "Rheumatology": [], "Risk Management & Pharmacovigilance": [], "RNA Based Therapies": [],
    "Stability": [], "Stem Cell & Regenerative Medicine": [], "Sterile Drug Products": [], "Supply Chain & Logistics": [],
    "Tools And Technology": [], "Translational Sciences": [], "Urology": [], "Vaccines, Immunology & Antibiotics": [], "Validation": [],
    "Viral Vectors": [], "Well Characterized Biologics (WCBP)": [], "Women's Health": []
};

const JOBS_CATEGORIES: Record<string, string[]> = {
    "Administration": [], "Analytical Sciences": [], "Artificial Intelligence & Bioinformatics": [], "Business Development": [],
    "Clinical Operations": [], "Clinical Research & Development": [], "Drug Discovery": [], "Engineering": [],
    "Facilities & Building Systems": [], "Finance": [], "Formulation & Development": [], "Health Technology & Market Access": [],
    "Human Resources & People Management": [], "Information Technology": [], "Legal": [], "Manufacturing & Technical Operations": [],
    "Manufacturing Sciences & Technology": [], "Market Access": [], "Marketing": [], "Other": [], "Pharmacology": [],
    "Pre Clinical Research & Development": [], "Product Development": [], "Project Or Program Management": [], "Quality & Compliance": [],
    "Quality Control": [], "Regulatory": [], "Sales": [], "Toxicology": [], "Translational Sciences": [], "Validation": []
};

const HEALTH_AUTHORITIES = [
    { country: "Afghanistan", url: "https://www.afda.gov.af/en/guidelines" }, { country: "Africa", url: "https://amrh.nepad.org/amrh-countries" }, { country: "Albania", url: "https://shendetesia.gov.al/" },
    { country: "Algeria", url: "https://ghdx.healthdata.org/organizations/ministry-health-population-and-hospital-reform-algeria" }, { country: "Andorra", url: "https://ghdx.healthdata.org/organizations/ministry-health-and-welfare-andorra" }, { country: "Angola", url: "https://www.trade.gov/country-commercial-guides/angola-healthcare#:~:text=ARMED's%20main%20objectives%20are%20to,WHO%20norms%20and%20Angolan%20regulations." },
    { country: "Antigua and Barbuda", url: "https://health.gov.ag/" }, { country: "Argentina", url: "https://www.argentina.gob.ar/anmat/anmat-en/what-anmat" }, { country: "Armenia", url: "http://www.pharm.am/index.php/en/" },
    { country: "Australia", url: "#" }, { country: "Austria", url: "#" }, { country: "Azerbaijan", url: "#" },
    { country: "Bahrain", url: "#" }, { country: "Bangladesh", url: "#" }, { country: "Barbados", url: "#" },
    { country: "Belarus", url: "#" }, { country: "Belgium", url: "#" }, { country: "Belize", url: "#" },
    { country: "Benin", url: "#" }, { country: "Bhutan", url: "#" }, { country: "Bolivia", url: "#" },
    { country: "Bosnia", url: "#" }, { country: "Botswana", url: "#" }, { country: "Brazil", url: "#" },
    { country: "Brunei", url: "#" }, { country: "Bulgaria", url: "#" }, { country: "Burkina Faso", url: "#" },
    { country: "Burundi", url: "#" }, { country: "Cabo Verde", url: "#" }, { country: "Cambodia", url: "#" },
    { country: "Cameroon", url: "#" }, { country: "Canada", url: "https://www.canada.ca/en/health-canada/corporate/about-health-canada/branches-agencies/health-products-food-branch.html" }, { country: "Central African Republic", url: "#" },
    { country: "Chad", url: "#" }, { country: "Chile", url: "#" }, { country: "China", url: "#" },
    { country: "Colombia", url: "#" }, { country: "Comoros", url: "#" }, { country: "Congo", url: "#" },
    { country: "Costa Rica", url: "#" }, { country: "Côte d'Ivoire", url: "#" }, { country: "Croatia", url: "#" },
    { country: "Cuba", url: "#" }, { country: "Cyprus", url: "#" }, { country: "Czech Republic", url: "#" },
    { country: "Denmark", url: "#" }, { country: "Djibouti", url: "#" }, { country: "Dominica", url: "#" },
    { country: "Dominican Republic", url: "#" }, { country: "Dubai", url: "#" }, { country: "East Timor", url: "#" },
    { country: "Ecuador", url: "#" }, { country: "Egypt", url: "#" }, { country: "El Salvador", url: "#" },
    { country: "Eritrea", url: "#" }, { country: "Estonia", url: "#" }, { country: "Eswatini", url: "#" },
    { country: "Ethiopia", url: "#" }, { country: "Europe (European Commission)", url: "#" }, { country: "Europe (European Medicines Agency)", url: "#" },
    { country: "Fiji", url: "#" }, { country: "Finland", url: "#" }, { country: "France", url: "#" },
    { country: "Gabon", url: "#" }, { country: "Gambia", url: "#" }, { country: "Georgia", url: "#" },
    { country: "Germany (Drugs & Medical Devices)", url: "#" }, { country: "Germany (Vaccines & Biomedicines)", url: "#" }, { country: "Ghana", url: "#" },
    { country: "Greece", url: "#" }, { country: "Grenada", url: "#" }, { country: "Guatemala", url: "#" },
    { country: "Guyana", url: "#" }, { country: "Haiti", url: "#" }, { country: "Honduras", url: "#" },
    { country: "Hong Kong", url: "#" }, { country: "Hungary", url: "#" }, { country: "Iceland", url: "#" },
    { country: "India", url: "#" }, { country: "Indonesia", url: "#" }, { country: "Iran", url: "#" },
    { country: "Iraq", url: "#" }, { country: "Ireland", url: "#" }, { country: "Israel", url: "#" },
    { country: "Italy", url: "#" }, { country: "Jamaica", url: "#" }, { country: "Japan", url: "#" },
    { country: "Jordon", url: "#" }, { country: "Kazakhstan", url: "#" }, { country: "Kenya", url: "#" },
    { country: "Kiribati", url: "#" }, { country: "Korea", url: "#" }, { country: "Kosovo", url: "#" },
    { country: "Kuwait", url: "#" }, { country: "Kyrgyzstan", url: "#" }, { country: "Laos", url: "#" },
    { country: "Latvia", url: "#" }, { country: "Lebanon", url: "#" }, { country: "Liberia", url: "#" },
    { country: "Libya", url: "#" }, { country: "Liechtenstein", url: "#" }, { country: "Lithuania", url: "#" },
    { country: "Luxembourg", url: "#" }, { country: "Madagascar", url: "#" }, { country: "Malawi", url: "#" },
    { country: "Malaysia", url: "#" }, { country: "Maldives", url: "#" }, { country: "Mali", url: "#" },
    { country: "Malta", url: "#" }, { country: "Marshall Islands", url: "#" }, { country: "Mauritius", url: "#" },
    { country: "Mexico", url: "#" }, { country: "Micronesia", url: "#" }, { country: "Moldova", url: "#" },
    { country: "Monaco", url: "#" }, { country: "Mongolia", url: "#" }, { country: "Montenegro", url: "#" },
    { country: "Morocco", url: "#" }, { country: "Mozambique", url: "#" }, { country: "Myanmar (Burma)", url: "#" },
    { country: "Namibia", url: "#" }, { country: "Nauru", url: "#" }, { country: "Nepal", url: "#" },
    { country: "Netherlands", url: "#" }, { country: "New Zealand", url: "#" }, { country: "Nicaragua", url: "#" },
    { country: "Niger", url: "#" }, { country: "Nigeria", url: "#" }, { country: "North Macedonia", url: "#" },
    { country: "Norway", url: "#" }, { country: "Oman", url: "#" }, { country: "Pakistan", url: "#" },
    { country: "Palau", url: "#" }, { country: "Palestine", url: "#" }, { country: "Panama", url: "#" },
    { country: "Papua New Guinea", url: "#" }, { country: "Paraguay", url: "#" }, { country: "Peru", url: "#" },
    { country: "Philippines", url: "#" }, { country: "Poland", url: "#" }, { country: "Portugal", url: "#" },
    { country: "Qatar", url: "#" }, { country: "Rawanda", url: "#" }, { country: "Romania", url: "#" },
    { country: "Russia", url: "#" }, { country: "Saint Kitts and Nevis", url: "#" }, { country: "Saint Vincent and Grenadines", url: "#" },
    { country: "Samoa", url: "#" }, { country: "San Marino, Ministry of Health", url: "#" }, { country: "Sao Tome and Principe", url: "#" },
    { country: "Saudi Arabia", url: "#" }, { country: "Senegal", url: "#" }, { country: "Serbia", url: "#" },
    { country: "Sierra Leone", url: "#" }, { country: "Singapore", url: "#" }, { country: "Slovak Republic", url: "#" },
    { country: "Slovenia", url: "#" }, { country: "Solomon Islands", url: "#" }, { country: "Somalia", url: "#" },
    { country: "South Africa", url: "#" }, { country: "Spain", url: "#" }, { country: "Spanish", url: "#" },
    { country: "Sri Lanka", url: "#" }, { country: "St. Lucia", url: "#" }, { country: "Sudan", url: "#" },
    { country: "Suriname", url: "#" }, { country: "Swaziland", url: "#" }, { country: "Sweden", url: "#" },
    { country: "Switzerland", url: "#" }, { country: "Syria", url: "#" }, { country: "Taiwan", url: "#" },
    { country: "Tanzania", url: "#" }, { country: "Thailand", url: "#" }, { country: "Therapeutic", url: "#" },
    { country: "Togo", url: "#" }, { country: "Tonga", url: "#" }, { country: "Trinidad and Tobago", url: "#" },
    { country: "Tunisia", url: "#" }, { country: "Turkey", url: "#" }, { country: "Turkmenistan", url: "#" },
    { country: "Tuvalu", url: "#" }, { country: "UAE", url: "#" }, { country: "Uganda", url: "#" },
    { country: "UK", url: "#" }, { country: "Ukraine", url: "#" }, { country: "Uruguay", url: "#" },
    { country: "Uzbekistan", url: "#" }, { country: "Vanuatu", url: "#" }, { country: "Venezuela", url: "#" },
    { country: "Yemen", url: "#" }, { country: "Zambia", url: "#" }, { country: "Zimbabwe", url: "#" }
];

export default function AllCategories() {
    const { category } = useParams<{ category: string }>();
    const currentTab = category || "business";

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);

    // Categories UI State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [searchCountry, setSearchCountry] = useState("");
    const [healthAuthSearch, setHealthAuthSearch] = useState("");
    const [showAllCategories, setShowAllCategories] = useState(false);

    useEffect(() => {
        const fetchAllCategoriesData = async () => {
            setLoading(true);
            try {
                let q: any = null;

                if (currentTab === "business") {
                    q = query(collection(db, "partnersCollection"), where("partnerStatus", "==", "Approved"));
                } else if (currentTab === "consulting") {
                    q = query(collection(db, "consultingCollection"), where("active", "==", true));
                } else if (currentTab === "events") {
                    q = query(collection(db, "eventsCollection"), where("active", "==", true));
                } else if (currentTab === "jobs") {
                    q = query(collection(db, "jobsCollection"), where("active", "==", true));
                }

                if (q) {
                    const snap = await getDocs(q);
                    setData(snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })));
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error("Error fetching AllCategories:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAllCategoriesData();
    }, [currentTab]);

    const handleCloseModal = () => setSelectedProfile(null);

    const toggleSubcategory = (sub: string) => {
        setSelectedSubcategories(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
    };

    const toggleExpandCategory = (cat: string) => {
        setExpandedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const resetCategorySelection = () => {
        setSelectedCategory(null);
        setSelectedSubcategories([]);
        setSearchCountry("");
    };

    // Derived states
    const isMainCategoryTab = currentTab === "business" || currentTab === "consulting" || currentTab === "events" || currentTab === "jobs";
    const currentCategoriesDict = currentTab === "business" ? BUSINESS_CATEGORIES : currentTab === "consulting" ? CONSULTING_CATEGORIES : currentTab === "events" ? EVENTS_CATEGORIES : JOBS_CATEGORIES;
    const featuredHeading = currentTab === "business" ? "Featured Businesses/Services" : currentTab === "consulting" ? "Meet the Experts" : currentTab === "events" ? "Featured Events" : "Featured Jobs/Opportunities";
    const noFeaturedText = currentTab === "business" ? "No featured businesses available at the moment." : currentTab === "consulting" ? "No experts available at the moment." : currentTab === "events" ? "No featured events available at the moment." : "No featured jobs available at the moment.";

    const filteredHealthAuths = HEALTH_AUTHORITIES.filter((auth) =>
        auth.country.toLowerCase().includes(healthAuthSearch.toLowerCase())
    );

    const filteredBusinesses = data.filter((item) => {
        if (!isMainCategoryTab) return true;
        // We assume businesses will eventually have `category` and `subcategory` fields.
        // For now this is a mock filter. In reality, it would check the item's properties.
        const matchCategory = !selectedCategory || item.category === selectedCategory || item.selectedGroup?.replace(/_/g, " ") === selectedCategory || item.consultingCategory === selectedCategory || item.eventCategory === selectedCategory || item.jobCategory === selectedCategory;
        const matchSubcategories = selectedSubcategories.length === 0 /* || selectedSubcategories.includes(item.subcategory) */;
        const matchCountry = !searchCountry || (item.businessAddress && item.businessAddress.toLowerCase().includes(searchCountry.toLowerCase()));

        return matchCategory && matchSubcategories && matchCountry;
    });

    const featuredBusinesses = data.filter(item => item.isFeatured === true);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="bg-muted/40 border-b border-foreground/10 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">All Categories</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                        Explore, connect, and collaborate with leading businesses, experts, and talent across the global biotech ecosystem.
                    </p>


                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="container mx-auto px-4 mt-8 flex-1">
                <Tabs value={currentTab} className="w-full flex flex-col items-center">
                    <TabsList className="bg-foreground/5 border border-foreground/10 mb-8 p-1 rounded-full w-fit justify-center flex-wrap sm:flex-nowrap h-auto mx-auto shadow-sm">
                        <TabsTrigger value="business" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/all-categories/business" className="flex items-center gap-2" onClick={resetCategorySelection}><Building2 className="w-4 h-4" /> Business Offerings</Link>
                        </TabsTrigger>
                        <TabsTrigger value="consulting" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/all-categories/consulting" className="flex items-center gap-2" onClick={resetCategorySelection}><Users className="w-4 h-4" /> Consulting Services</Link>
                        </TabsTrigger>
                        <TabsTrigger value="events" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/all-categories/events" className="flex items-center gap-2" onClick={resetCategorySelection}><Calendar className="w-4 h-4" /> Events</Link>
                        </TabsTrigger>
                        <TabsTrigger value="jobs" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/all-categories/jobs" className="flex items-center gap-2" onClick={resetCategorySelection}><Briefcase className="w-4 h-4" /> Jobs</Link>
                        </TabsTrigger>
                        <TabsTrigger value="compliance" asChild className="rounded-full px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Link to="/all-categories/compliance" className="flex items-center gap-2" onClick={resetCategorySelection}><ShieldCheck className="w-4 h-4" /> Global Health Authority Sites</Link>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Dynamic Content Area */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading {currentTab}...</div>
                ) : isMainCategoryTab && !selectedCategory ? (
                    // GRID OF ALL CATEGORIES
                    <div className="flex flex-col gap-16 pb-24 w-full w-full max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(showAllCategories ? Object.keys(currentCategoriesDict) : Object.keys(currentCategoriesDict).slice(0, 11)).map((catName) => (
                                <div
                                    key={catName}
                                    onClick={() => setSelectedCategory(catName)}
                                    className="p-6 border border-foreground/10 hover:border-primary/50 transition-all rounded-xl shadow-sm hover:shadow-md bg-background cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px] group"
                                >
                                    <span className="font-medium text-sm md:text-base group-hover:text-primary transition-colors">{catName}</span>
                                </div>
                            ))}
                            {!showAllCategories && Object.keys(currentCategoriesDict).length > 11 && (
                                <div
                                    onClick={() => setShowAllCategories(true)}
                                    className="p-6 border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary hover:bg-primary/5 transition-all rounded-xl shadow-sm cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px]"
                                >
                                    <span className="font-bold text-sm md:text-base inline-flex items-center gap-2">View All {Object.keys(currentCategoriesDict).length} Categories <ChevronDown className="w-4 h-4" /></span>
                                </div>
                            )}
                        </div>

                        {/* FEATURED BUSINESSES BELOW THE GRID */}
                        <div className="flex flex-col items-center mt-8">
                            <h3 className="text-2xl font-bold tracking-widest uppercase mb-12">{featuredHeading}</h3>
                            {featuredBusinesses.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                    {featuredBusinesses.map(fb => (
                                        <div
                                            key={fb.id}
                                            onClick={() => setSelectedProfile(fb)}
                                            className="p-6 border border-foreground/10 hover:border-primary/50 transition-colors rounded-xl shadow-sm hover:shadow-md bg-background cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px]"
                                        >
                                            <span className="font-medium text-lg">{currentTab === "business" ? fb.businessName : currentTab === "consulting" ? (fb.primaryName || fb.businessName) : currentTab === "events" ? fb.eventName : fb.jobTitle}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground">{noFeaturedText}</div>
                            )}
                        </div>
                    </div>
                ) : isMainCategoryTab && selectedCategory ? (
                    // SELECTED CATEGORY VIEW: SIDEBAR + LIST OF COMPANIES
                    <div className="flex flex-col md:flex-row gap-8 pb-24">
                        <div className="w-full md:w-72 shrink-0 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold mb-2 block">Search by country</label>
                                    <Input
                                        className="h-10 rounded-xl bg-foreground/5 border-foreground/10"
                                        placeholder=""
                                        value={searchCountry}
                                        onChange={(e) => setSearchCountry(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {Object.entries(currentCategoriesDict).map(([cat, subs]) => {
                                        const isExpanded = expandedCategories.includes(cat);
                                        const isSelectedCategory = cat === selectedCategory;
                                        return (
                                            <div key={cat} className="flex flex-col gap-2">
                                                <div className="flex items-start gap-2">
                                                    {subs.length > 0 ? (
                                                        <button onClick={() => toggleExpandCategory(cat)} className="mt-1 flex-shrink-0">
                                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                                        </button>
                                                    ) : (
                                                        <span className="w-4 h-4 flex-shrink-0" /> // spacer
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={cat}
                                                            checked={isSelectedCategory}
                                                            onCheckedChange={() => setSelectedCategory(isSelectedCategory ? null : cat)}
                                                        />
                                                        <label htmlFor={cat} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">{cat}</label>
                                                    </div>
                                                </div>

                                                {isExpanded && subs.length > 0 && (
                                                    <div className="pl-10 space-y-2 mb-2">
                                                        {subs.map(sub => (
                                                            <div key={sub} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`${cat}-${sub}`}
                                                                    checked={selectedSubcategories.includes(sub)}
                                                                    onCheckedChange={() => toggleSubcategory(sub)}
                                                                />
                                                                <label htmlFor={`${cat}-${sub}`} className="text-sm font-light leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground">{sub}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* LIST OF COMPANIES IN GRID */}
                        <div className="flex-1">
                            {filteredBusinesses.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                                    No companies matched your criteria.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredBusinesses.map((item) => {
                                        const title = currentTab === "business" ? item.businessName : currentTab === "consulting" ? (item.primaryName || item.businessName) : currentTab === "events" ? item.eventName : item.jobTitle;
                                        const topLabel = currentTab === "business" ? `BSL : ${item.bsl || "N/A"}` : currentTab === "consulting" ? `Location: ${item.businessAddress || "N/A"}` : currentTab === "events" ? `Date: ${item.startDate || "TBA"}` : `Location: ${item.city || item.location || "Remote"}`;
                                        const bottomLabel = currentTab === "business" ? (item.certifications || "No specific certs") : currentTab === "consulting" ? (item.focusArea || "Consultant") : currentTab === "events" ? `${item.city || "Venue"}, ${item.location || ""}` : `${item.businessName || "Company"} • ${item.jobtype || "Role"}`;

                                        return (
                                            <div key={item.id} onClick={() => setSelectedProfile(item)} className="group rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer overflow-hidden flex flex-col h-[320px]">
                                                <div className="p-8 flex-1 flex items-center justify-center bg-background border-b border-foreground/10 text-center relative overflow-hidden">
                                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-3">
                                                        {title}
                                                    </h3>
                                                </div>
                                                <div className="p-4 bg-muted/40 flex flex-col items-center justify-center h-24">
                                                    <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                                                        {topLabel}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                                        {bottomLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : currentTab === "compliance" ? (
                    <div className="flex-1 max-w-7xl mx-auto w-full pb-24 flex flex-col items-center">
                        <div className="text-center space-y-4 mb-12">
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Global Health Authority Sites</h2>
                            <p className="text-muted-foreground text-sm sm:text-base max-w-3xl mx-auto">
                                Bid farewell to endless searches and fragmented information. Our platform serves as your compass, making navigation of health authority sites effortless and efficient.
                            </p>
                        </div>

                        <div className="w-full max-w-xl mx-auto mb-16 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="Search for a country..."
                                value={healthAuthSearch}
                                onChange={(e) => setHealthAuthSearch(e.target.value)}
                                className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full"
                            />
                        </div>

                        <div className="w-full columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                            {filteredHealthAuths.length > 0 ? (
                                filteredHealthAuths.map((auth, index) => (
                                    <a
                                        key={index}
                                        href={auth.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="break-inside-avoid shadow-sm hover:shadow-md border border-foreground/10 hover:border-primary/50 bg-background p-4 rounded-xl flex items-center justify-between group transition-all"
                                    >
                                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate pr-4">{auth.country}</span>
                                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                    </a>
                                ))
                            ) : (
                                <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 text-center p-12 text-muted-foreground">
                                    No countries found matching "{healthAuthSearch}"
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                        {data.length === 0 ? "No listings found for this category right now. Check back soon." : "We're currently assembling listings for this category."}
                    </div>
                )}
            </div>

            {selectedProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal}>
                    <div className="bg-background border border-foreground/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-foreground/10 bg-foreground/5">
                            <h2 className="text-2xl font-bold">Details</h2>
                            <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            {(currentTab === 'business' || currentTab === 'consulting') && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{currentTab === 'consulting' ? (selectedProfile.primaryName || selectedProfile.businessName) : selectedProfile.businessName}</h3>
                                        {selectedProfile.businessAddress && <p className="text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4" /> {selectedProfile.businessAddress}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Focus</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedGroup?.replace(/_/g, ' ') || selectedProfile.focusArea || "N/A"}</p>
                                        </div>
                                        <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10">
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Classification</p>
                                            <p className="font-semibold capitalize">{selectedProfile.selectedPlan?.replace(/_/g, ' ') || "N/A"}</p>
                                        </div>
                                    </div>
                                    {selectedProfile.companyProfileText && (
                                        <div>
                                            <p className="font-bold mb-2">{currentTab === 'consulting' ? "Expert Profile" : "Company Overview"}</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.companyProfileText}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Removed inline consulting detail block so it uses the business one if needed */}

                            {currentTab === 'jobs' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.jobTitle}</h3>
                                        <p className="text-lg text-muted-foreground font-medium">{selectedProfile.businessName} • {selectedProfile.industry}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Location:</span>{selectedProfile.city}, {selectedProfile.state}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Work Model:</span>{selectedProfile.workModel}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Experience:</span>{selectedProfile.experienceLevel}</p>
                                        <p className="text-sm"><span className="text-muted-foreground mr-2">Type:</span>{selectedProfile.jobtype}</p>
                                    </div>
                                    {selectedProfile.jobSummary && (
                                        <div>
                                            <p className="font-bold mb-2">Role Summary</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.jobSummary}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {currentTab === 'events' && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-bold text-primary">{selectedProfile.eventName}</h3>
                                        <p className="text-lg font-medium text-muted-foreground flex items-center gap-2"><Calendar className="w-5 h-5" /> {selectedProfile.startDate}</p>
                                    </div>
                                    <div className="bg-muted/40 p-4 rounded-lg border border-foreground/10 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">City</p>
                                            <p className="font-semibold">{selectedProfile.city}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Venue</p>
                                            <p className="font-semibold">{selectedProfile.location}</p>
                                        </div>
                                    </div>
                                    {selectedProfile.categories && (
                                        <div>
                                            <p className="font-bold mb-2">Topics & Categories</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProfile.categories.map((c: string, j: number) => (
                                                    <span key={j} className="bg-foreground/10 px-3 py-1 rounded-full text-sm">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-foreground/10 bg-black/20 flex gap-4">
                            <Button className="w-full" size="lg">Contact / Proceed</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
