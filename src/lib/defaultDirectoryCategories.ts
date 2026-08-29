export type SubcategoryEntry = string | { label: string; subSubcategories: string[] };
export type CategoriesDict = Record<string, SubcategoryEntry[]>;

export interface DirectoryCategoryDoc {
    id?: string;
    group?: string;
    parentCategory?: string;
    category?: string;
    categoryName?: string;
    subcategory?: string;
    subSubcategory?: string;
    status?: string;
    imageUrl?: string;
    metaDescription?: string;
    metaKeywords?: string;
    description?: string;
    [key: string]: any;
}

export const getSubLabel = (entry: SubcategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

export const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
    typeof entry !== "string";

export const DEFAULT_BUSINESS_CATEGORIES: CategoriesDict = {
    "Artificial Intelligence & Bioinformatics": [],
    "Automation": ["Equipment", "Facility", "Laboratory Systems", "Manufacturing", "Other", "Packaging", "Process Analytical Technologies", "Warehouse"],
    "Building Systems & Controls": [],
    "Buildings & Used Equipment": ["GMP Space", "Lab Space", "Non-GMP Space", "Used Equipment"],
    "Cell & Virus Banks": ["Characterization", "Creation", "Cryopreservation", "DNA Sizing & Barcoding", "Genetic Stability", "Qualification", "Release testing", "Storage"],
    "Cleaning Agents": [],
    "Cleaning Services": [],
    "Clinical & Diagnostic Testing": ["Blood", "Compartmental Specimens", "Donor", "Genetics", "HLA Typing", "Molecular Specimens", "Plasma", "Serum", "Tissues"],
    "Clinical Research & Development": [],
    "Container Closures & Packaging": ["Adverse Event Management", "Animal Research Centers", "Audits", "Biobanking & Storage", "Biospecimen Services", "Biostats", "Contract Support", "Data Management", "Decentralized Trials", "End to End Pharmacovigilance System", "EU QPPV", "Lab & Analytical Services", "Literature Screening", "Local Contact Person", "Mice Models for Research", "Non-Human Primates for Research", "Other", "Patient Recruitment & Support", "Patient Support", "Pharmacovigilance", "Post Authorization Safety Studies", "Post Marketing Surveillance", "Pre-Clinical Studies", "Primate Models for Research", "Product Complaints Management", "Project Management", "Protocol Writing", "Real World Evidence", "Research Platforms", "Site Management", "Site Selection & Qualification", "Specialty Testing", "Target & Lead Optimization", "Translational Sciences", "Trial Planning & Management", "Vendor Management"],
    "Digital Solutions For Life Sciences": [],
    "Engineering": ["Computer Systems", "Environmental Controls", "Equipment", "Facility", "Process", "Utilities", "Warehouse"],
    "Environmental Monitoring & Testing": [],
    "Equipment": ["Auxiliary Equipment", "Building Systems", "Calibration", "Cleaning", "Drug Product Manufacturing & Filling", "Drug Substance Manufacturing", "Laboratory", "Maintenance & Repair", "Other", "Packaging", "Storage", "Warehouse", "Water Purification"],
    "Facility Design And Qualifications": ["Drug Product Manufacturing", "Drug Substance Manufacturing", "Filling", "Laboratory", "Other", "Packaging", "Storage", "Utilities", "Warehouse", "Water Purification"],
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
    "Laboratory & Related Services": [
        "Analytical Assay Development", "Apheresis and Cell Therapy Collections", "Biobanking & Storage", "Cell line Qualification & Characterization", "Central Lab Services", "Chemicals, Reagents & Materials", "Cleaning Method Development", "Clinical & Dianostics", "Comparability Study Design & Testing", "Custom Assay Development", "Custom Hybridoma & Antibody Generation", "Equipment Maintenance & Calibration", "Extractable and Leachable Studies", "Filter Compatibility Studies", "Gases", "Genomics for Infectious Diseases", "Global Sample Logistics", "HCP Assay Development", "Immune Repertoire Sequencing", "Immunogen & Antigen Generation", "Immunogenecity Testing", "In-Use/Compatibility Studies", "Insilico Studies", "Instruments", "Lab Supplies & Consumables", "Laboratory Informatics", "Laboratory Network",
        { label: "Material Qualification", subSubcategories: ["Cell & Virus Banks", "GMP Materials", "Lipids", "Non-GMP", "Novel Excipients", "Polymers", "Raw Materials", "Solvents", "Specialty Materials"] },
        "Media Fill Studies", "Medical Device Testing", "Method Qualification & Validation", "Method Transfer", "Off Target Analysis", "Pathology & Tissue Analysis", "Pre-Analytical & PBMC", "Processing", "Raiolabeled Materials", "Reference Standard Establishment & Qualification", "Reference Standard Qualification", "RNA & DNA Extraction", "Software & Digital Solutions", "Stability", "Stability Storage & Testing", "Sterile Filter Validation Studies",
        { label: "Testing", subSubcategories: ["Adventitious Agents", "Bioassays , Cell Based & Potency Assays", "Biologics", "Biosafety", "Cell Banks", "Cell Therapies", "Characterization Assays", "Chemical & Physical", "Cleaning Samples", "Compendial Testing", "Container Closures & Components", "Container Closure Integrity", "Creams and Ointments", "Diagnostics", "Dispersion", "Enzymatic Assays", "Excipients", "Flow Cytometry", "Gases", "Genetic Stability", "Genotyping & Phenotyping", "Immunoassays", "Inhalation products", "Liquids", "Microbiology & Sterility", "Microorganism Identification", "Mycoplasma Testing", "NGS", "Non-Solid Sterile Products", "Ophthalmic Products", "Plasmid", "Potent & Toxic Materials", "QC Testing", "Raw Materials", "RNA Based Therapies", "Small Molecules", "Solid Dosages", "Solvents", "Specialty Services", "Sterile Products", "Toxicology", "Trace Metals", "Traditional Vaccines Testing", "Unprocessed Bulk", "Viral Safety", "Viral Vector Based Products", "Water"] },
        "Water Purification"
    ],
    "Manufacturers": [
        { label: "Drug Product", subSubcategories: ["Capsules", "Combination Products", "Controlled Release", "Emulsions", "Inhalation Products", "Inhalers", "Injectables", "Liquids", "Lyophilized", "Nano Technology", "Nasal Products", "Novel Modalities", "Nucleic acid", "Ophthalmic Products", "Other", "Patient Specific", "Personalized Medicines", "Powders", "Radiopharmaceuticals", "RNA", "Solid Dispersions", "Solid Oral Dosage", "Specialty Services", "Sprays", "Sterile Products", "Suppositories", "Topicals", "Viruses", "Visual Inspection"] },
        { label: "Drug Substance", subSubcategories: ["iPSC-based therapies", "Advanced Therapies", "Antibody Conjugates", "Biologics & Large Molecules", "Biosimilars", "Bispecifics", "Cell & Gene Therapies", "Chemical Entities & Active Pharmaceutical Ingredients", "Gene Editing Based Therapies", "Novel Modalities", "Nucleic Acid Based Therapies", "Oncolytic Virus Based Therapies", "Other", "Patient Specific", "Personalized Medicines", "Plasmid DNA", "Radiopharmaceuticals", "RNA Based Therapies", "Vaccines", "Viral Vector Therapies"] },
        { label: "Packaging", subSubcategories: ["Blister Packaging", "Customized Services", "Medical Device Packaging", "Primary Packaging & Labeling", "Repackaging & Labeling", "Secondary Packaging & Labeling", "Serialization", "Sleeve Packaging", "Track & Trace Services", "Visual Inspection"] },
        { label: "Vaccine Manufacturing", subSubcategories: ["Anti Sera", "Combination", "Conjugate", "Inactivated", "Live-Attenuated", "Non-Replicating Viral Vector", "Nucleic Acid Vaccines", "Recombinant", "Replicating Viral Vector", "Subunit Vaccines", "Toxoid", "Whole Pathogen"] },
    ],
    "Material Sciences": [],
    "Materials/ Excipients / Cells": ["B Cells", "Biomedical Materials", "Buffers", "Cell Strains", "Chemicals", "Compendial Excipients", "Consumables", "Custom GMP Excipients", "Custom Media", "DC Cells", "Enzymes", "Expression Systems", "Gases", "Genes", "Hematopoietic Stem Cells", "Insect Cell Lines", "Lipids", "Mammalian Cells", "Media", "Microbial Cells", "MSC Cells", "NK Cells", "Non-Compendial Excipients", "Non-GMP Excipients", "Novel Excipients", "Nucleic Acids", "Oligos", "Other Materials", "Polymers", "Primary Human Cells", "Primers & Probes", "Process Reagents", "Proteins", "Raw Materials", "Solutions", "Solvents", "Specialty Materials", "Stem Cell Derived Lines", "Sterile Filters", "T cells (aβ, γδ, Treg)", "TIL Cells", "Tissue Cultures", "Yeast Cell Lines"],
    "Medical Devices & Delivery Systems": [
        "Ablation Therapy", "Cardiology", "Cardiovascular", "CE Marking Certification", "CE Marking Testing Services", "Central Nervous System",
        { label: "Clinical Research", subSubcategories: ["Adverse Event Management", "Audits", "Biostats", "Contract Support", "Data Management", "Lab & Analytical Services", "Model Selection", "Patient Recruitment & Support", "Patient Support", "Pharmacovigilance", "Post Marketing Surveillance", "Product Complaints Management", "Project Management", "Protocol Writing", "Research Platforms", "Site Management", "Site Selection & Qualification", "Specialty Testing", "Study Design", "Target & Lead Optimization", "Trial Planning & Management", "Vendor Management"] },
        "Companion Diagnostics", "Consumer Health", "Critical Care", "Dermatology", "Design & Development", "Diagnostics", "Distribution", "Electrosurgical Tools", "Engineering", "Imaging", "Implantable", "In Vitro Diagnostics", "Infectious Diseases", "ISO Certifications", "Laboratory Instruments", "Manufacturers", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurological Disorders", "Oncology", "Ophthalmology", "Other", "Packaging", "Packaging & Assembly", "Pediatrics", "Performance Evaluation", "Protective Equipment", "Respiratory", "Rheumatology", "Single Use", "Software for Devices", "Surgical Devices", "Testing", "Urology", "Validation Or Qualification", "Women's Health"
    ],
    "Medical Writing": [],
    "Non-Clinical Research/Related Activities": [],
    "Other": [],
    "Pest Control (GMP Facility)": [],
    "Pharmacology & Toxicology Studies": [],
    "Pre-Clinical Research": [],
    "Process Characterization Studies": [],
    "Process Development": [],
    "Project Management": ["Clinical", "CMC", "Equipment Installation & Qualification", "Facility Projects", "Non-Clinical", "Other"],
    "QP Services": [],
    "Radiopharmaceuticals": ["Clinical Research", "Development", "Manufacturing", "Other", "Packaging", "Pre-Clinical Research", "Testing"],
    "Regulatory Operations & Publishing": [],
    "Regulatory Services": ["Clinical writing", "CMC writing", "Non-clinical writing", "Other"],
    "Shipping Services": ["≤ -20 ˚C", "≤ -60 ˚C", "2-8 ˚C", "Ambient", "Cold Chain Solutions", "Other", "Shipping Validation", "Specialty Services", "Temperature Mapping Studies"],
    "Statistical Analysis": [],
    "Storage & Distribution": ["≤ -20 ˚C", "≤ -60 ˚C", "2-8 ˚C", "Ambient", "Cold Chain Solutions", "Other", "Specialty Services", "Temperature Mapping Studies"],
    "Technical CMC Writing": [],
    "Technology Transfer": [],
    "Therapeutic Areas": ["Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Immuno-Oncology", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthalmology", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women's Health"],
    "Translational Sciences/Pre-Clinical Work": [],
    "Translations": [],
    "Validation & Qualification": [
        "Cleaning", "Computer Systems", "Environmental Control Systems",
        { label: "Equipment", subSubcategories: ["Manufacturing", "Packaging"] },
        "Facility", "Manufacturing Process", "Master Plans", "Other", "Protocol and Report Writing", "Shipping", "Water Systems"
    ],
    "Virus Clearance Studies": [],
    "Water": ["Bacteriostatic", "Distilled", "GMP Manufacturing", "Medical Device Manufacturing", "Parenteral Formulation", "Purified", "Saline Solutions", "Sterile Water for Inhalation", "Sterile Water for Injection", "Sterile Water for Irrigation", "Sterile water for Ophthalmic Solutions/Use"]
};

export const DEFAULT_CONSULTING_CATEGORIES: CategoriesDict = {
    "Advisory Board": ["Clinical", "CMC", "Labeling", "Regulatory", "Target Selection"],
    "Analytical Comparability": [],
    "Analytical Methods": ["Advanced Therapies", "Artificial Intellidence", "Bioinformatics", "Cell Banks", "Cell Lines", "Cell Therapies", "Excipients", "Genetic Stability", "Immunoassays", "Laboratory systems & design", "Non-Sterile Products", "Novel Therapies", "Others", "Potency & Bioassays", "Raw Materials", "RNA Therapies", "Small Molecules", "Sterile Products", "Virus Based Therapies"],
    "Artificial Intelligence": [],
    "Asset Evaluation": [],
    "Auditing": ["Clinical Sites", "GLP", "GMP", "ISO Certification", "Remediation"],
    "Automation": ["Equipment", "Facility", "Laboratory", "Manufacturing", "Utilities", "Warehouse"],
    "Bioinformatics": [],
    "Biostatistics & Data Science": [],
    "Clinical Trials & Research": [],
    "Cold Chain Solutions": [],
    "Commercialization": ["Commercial Strategy", "Competitive Intelligence", "Market Access & Health Technology", "Market Research", "Pricing", "Sales & Marketing"],
    "Compatibility (In-Use) Studies": [],
    "Consent Decree & Warning Letters": [],
    "Contract Manufacturing Site Management": [],
    "Contract Research Site Management": [],
    "Due Diligence": [],
    "Engineering": ["Computer Systems", "Equipment", "Facility", "Laboratory Systems & Design", "Process", "Warehouse"],
    "Environmental Impact Assessments": [],
    "Environmental Monitoring & Testing": [],
    "Extractable & Leachable Studies": [],
    "Facility Design & Qualifications": ["Drug Product Manufacturing", "Drug Substance Manufacturing", "Filling", "Laboratory", "Other", "Packaging", "Storage", "Utilities", "Warehouse", "Water Purification"],
    "Facility Maintenance & Support": [],
    "Formulation Development": [],
    "Gene Editing Based Therapies": [],
    "Genomics": [],
    "Genomics & Related Services": [],
    "Global Sample Logistics": [],
    "GMO Applications": [],
    "GMP/GXP Training": [],
    "Import & Export Services": [],
    "In Country Representative": [],
    "In Country Testing": [],
    "Insilico Assessments": [],
    "Integrated Control Strategy": [],
    "Interim Functional Leadership": [],
    "Key Opinion Leaders": ["Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthamalmology", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women's Health"],
    "Labeling & Translation": [],
    "Labeling Requirements & Design": [],
    "Legal/IP Services": ["Africa", "Asia", "Australia", "Europe", "Middle East", "New Zealand", "North America", "South America", "Switzerland", "UK"],
    "Lot Release Program": [],
    "Manufacturing Capacity Planning": [],
    "Material Qualification": ["Cell & Virus Banks", "Lipids", "Non-GMP", "Novel Excipients", "Polymers", "Raw Materials", "Solvents", "Speciality Materials"],
    "Material Sciences": [],
    "Medical Affairs": [],
    "Medical Devices": ["Ablation Therapy", "Audits", "Cardiovasular", "CE Mark", "Central Nervous System", "Clinical Trials", "Companion Diagnostics", "Consumer Health", "Critical Care", "Data Management", "Dermatology", "Design", "Development", "Diagnostics", "Imaging", "Implantable", "In vitro Diagnostics", "Infectious Diseases", "ISO Certifications", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Model Selection", "Ophthalmology", "Pharmacovigilance", "Post Market Surveillance", "Project Management", "Protocol Writing", "Quality Systems", "Respiratory", "Single Use", "Software for Devices", "SOPs Draftin g& Review", "Surgical Devices", "Trial Planning & Management", "Validation", "Vendor Management", "Women's Health"],
    "Medical Devices In Vitro Diagnostics": [],
    "Medical Writing": [],
    "Microbial Control Strategy": [],
    "Other": [],
    "Personalized Medicines": [],
    "Pharmacology & Toxicology": [],
    "Pharmacovigilance": [],
    "Post Market Surveillance": [],
    "Process Characterization Studies": [],
    "Process Development": [],
    "Project & Program Management": ["Automation", "Clinical", "CMC", "Equipment", "Facility", "Non-Clinical", "Portfolio Assessment & Prioritization", " Timeline Development & Analysis"],
    "Quality & Compliance": ["In Country Representative", "QMS Design & Review", "QP Support", "Quality Assurance", "SOP Review & Writing", "Supplier Oversight", "supplier Qualification"],
    "Quality Control": ["Other", "QC Lab Oversight", "QC Strategy"],
    "Radiolabeled Materials": [],
    "Radiopharmaceuticals": ["Analytical", "Clinical Research", "Development", "Manufacturing", "Pre-Clinical Research"],
    "Reference Standards": [],
    "Regulatory Sciences": ["Advanced Therapies", "Africa", "Asia", "Australia", "Biosimilars", "Cell & Gene Therapies", "Clinical Holds", "Clinical Strategy", "CMC Strategy", "Combination Products", "Complete Response", "CTD Sections Authoring & Review (Clinical)", "CTD Sections Authoring & Review (Non- Clinical)", "CTD Sections Authoring & Review (CMC)", "Due Diligence", "Europe", "FDA Advisory Committee", "Gene Editing Based Therapies", "Health Authority Meetings", "Human Cell Based Therapies", "In Country Agent & Representative", "Medical Devices", "Middle East", "New Zealand", "North America", "Novel Therapies", "Oncolytic Virus Based Therapies", "Other", "Personalized Medicines", "Preclinical & Nonclinical Stratgy", "Protocol Review & Writing", "Radiopharmaceuticals", "RNA Based Therapies", "Small Molecules", "South America", "Sterile Products", "Study & Protocol Design", "Switzerland", "Traditional Vaccines", "UK", "Vaccines (Newer Technologies)", "Viral Vector Based Therapies"],
    "Research & Development": ["Audits", "Biostats", "Clinical Development", "Contract Support", "Data Management", "EU QPPV", "Lead Optimization", "Literature Screening", "Local Contact", "Non-Clinical Development", "Patient Support", "Pharmacovigilance", "Post Marketing Surveillance", "Pre-Clinical Research", "Project Management", "Protocol Writing", "Real World Evidence", "Site Qualification & Management", "Study Design", "Target & Lead Optimization", "Translational Sciences", "Trial Planning & Management", "Vendor Management", "Vendor Selection"],
    "Risk Assessments": ["Environmental Controls", "Excipients", "Facility", "Formulation", "Impurity", "Material", "Microbial Controls", "Process"],
    "Scientific Advisory": [],
    "Specialty Services": [],
    "Specification Assessment": [],
    "Stability Strategy": ["-20C", "-60C", "2-8C", "Ambient Conditions", "Ambient Conditions/High RH", "Ultra Cold"],
    "Stability Studies": ["Accelerated", "Advanced Therapies", "Biologics", "Comparability", "Forced Degradation", "Novel Therapies", "Photostability", "Rare Diseases", "RNA Based Products", "Small Molecules", "Virus Based Products"],
    "Statistical Analysis": [],
    "Statistical Analysis CMC": [],
    "Sterile Filter Validation Or Qualification": [],
    "Supply Chain Solutions": ["Cold Chain Solutions", "Speciality Services"],
    "Target Selection": [],
    "Technical Writing": ["Clinical", "CMC", "Medical Writing", "Non-Clinical"],
    "Technology & Software": [],
    "Technology Transfer & Process Development": [],
    "Therapeutic Areas": ["Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Infectious Diseases", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthalmology", "Other", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women's Health"],
    "Translations": [],
    "Translators": [],
    "Validation": ["Automation", "Cleaning", "Computer Systems", "Environmental Controls", "Equipment", "Facility", "Laboratory Systems", "Master Plans", "Method", "Other", "Process", "Protocol & Report Writing", "Shipping"],
    "Viral Safety & Clearance Studies": [],
    "Warehouse Controls": ["Temperature Mapping Studies"],
    "Water Purification Systems": []
};

export const DEFAULT_EVENTS_CATEGORIES: CategoriesDict = {
    "AAPS (American Association Of Pharmaceutical Scientists)": [],
    "Advanced & Next Generation Therapies": [],
    "Analytical Development & Testing": [],
    "Analytical Methods": [],
    "Antibodies & Antibody Conjugates": [],
    "Artificial Intelligence, Bioinformatics & Technology": [],
    "Aseptic Technologies": [],
    "Bioassays": [],
    "Biomarkers & Diagnostics": [],
    "Biomaterials & Biodevices": [],
    "Biosimilars": [],
    "Biotechnology": [],
    "Bispecifics": [],
    "Building Systems & Controls": [],
    "CASSS": [],
    "Cell & Gene Therapy": [],
    "Chemistry Manufacturing & Controls (CMC)": [],
    "Clinical Research & Development": [],
    "Clinical Trials & Research": [],
    "Comparability": [],
    "Continuous Manufacturing/PAT/Real Time Quality": [],
    "Dermatology": [],
    "DIA (Drug Information Association)": [],
    "Diabetes & Cardiovascular Diseases": [],
    "Digital Innovation In Health Care": [],
    "Drug Discovery & Development": [],
    "Drug Safety": [],
    "Epidemiology": [],
    "Formulation & Drug Delivery": [],
    "Gastroenterology": [],
    "Gene Editing": [],
    "Genomics": [],
    "GMP Facilities": [],
    "Good Manufacturing Practices (GMPs)": [],
    "Health Care Conference": [],
    "Health Policy": [],
    "Health Technology Assessment": [],
    "Hematology": [],
    "Hepatology": [],
    "Higher Order Structure": [],
    "ICH Conferences": [],
    "Infectious Diseases": [],
    "Intellectual Property": [],
    "ISPE (International Society For Pharmaceutical Engineering)": [],
    "Labelling": [],
    "Laboratory Equipment": [],
    "Manufacturing & Technical Operations": [],
    "Manufacturing Equipment": [],
    "Market Access": [],
    "Marketing & Sales": [],
    "Mass Spectrometry": [],
    "Materials, Reagents & Excipients": [],
    "Medical Affairs": [],
    "Medical Devices": ["Abilation Therapy", "Bispecifics", "Cardiovascular", "Central Nervous System", "Companion Diagnostics", "Consumer Health", "Critical Care", "Dermatology", "Diagnostics", "Gene Editing", "Imaging", "Implanatable", "In Vitro Diagnostics", "Infectious Diseases", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Nucleic Acid Based Therapies", "Ophthalmology", "Respiratory", "RNA Based Therapies", "Single Use", "Software for Devices", "Surgical Devices", "Women's Health"],
    "Medical Equipment": [],
    "Medicinal & Pharmaceutical Chemistry": [],
    "Men's Health": [],
    "Metabolic & Endocrine": [],
    "Microbiology, Virology, Immunology & Infectious Diseases": [],
    "Molecular & Precision Medicine": [],
    "Nephrology": [],
    "Neurology & Psychiatry": [],
    "Nucleic Acid Based Therapies": [],
    "Oncology": [],
    "Other": [],
    "Patient Recruitment & Engagement": [],
    "Pediatrics": [],
    "Pharmaceutical Law": [],
    "Pharmaceutical Science": [],
    "Pharmaceuticals": [],
    "Pharmacology & Toxicology": [],
    "Potency Assays": [],
    "Pre-Clinical Research & Development": [],
    "Pricing & Health Technology": [],
    "Quality & Compliance": [],
    "Radiopharmaceuticals": [],
    "Rare Disease & Orphan Drug Products": [],
    "Regulations & Guidances": [],
    "Regulatory Affairs": [],
    "Research & Innovation": [],
    "Respiratory": [],
    "Rheumatology": [],
    "Risk Management & Pharmacovigilance": [],
    "RNA Based Therapies": [],
    "Stability": [],
    "Stem Cell & Regenerative Medicine": [],
    "Sterile Drug Products": [],
    "Supply Chain & Logistics": [],
    "Tools And Technology": [],
    "Translational Sciences": [],
    "Urology": ["<= -60C"],
    "Vaccines, Immunology & Antibiotics": [],
    "Validation": [],
    "Viral Vectors": [],
    "Well Characterized Biologics (WCBP)": [],
    "Women's Health": []
};

export const DEFAULT_JOBS_CATEGORIES: CategoriesDict = {
    "Administration": [],
    "Analytical Sciences": [],
    "Artificial Intelligence & Bioinformatics": [],
    "Business Development": [],
    "Clinical Operations": [],
    "Clinical Research & Development": [],
    "Drug Discovery": [],
    "Engineering": [],
    "Facilities & Building Systems": [],
    "Finance": [],
    "Formulation & Development": [],
    "Health Technology & Market Access": [],
    "Human Resources & People Management": [],
    "Information Technology": [],
    "Legal": [],
    "Manufacturing & Technical Operations": [],
    "Manufacturing Sciences & Technology": [],
    "Market Access": [],
    "Marketing": [],
    "Other": [],
    "Pharmacology": [],
    "Pre Clinical Research & Development": [],
    "Product Development": [],
    "Project Or Program Management": [],
    "Quality & Compliance": [],
    "Quality Control": [],
    "Regulatory": [],
    "Sales": [],
    "Toxicology": [],
    "Translational Sciences": [],
    "Validation": []
};

// Aliases for backwards-compatibility
export const BUSINESS_CATEGORIES = DEFAULT_BUSINESS_CATEGORIES;
export const CONSULTING_CATEGORIES = DEFAULT_CONSULTING_CATEGORIES;
export const EVENTS_CATEGORIES = DEFAULT_EVENTS_CATEGORIES;
export const JOBS_CATEGORIES = DEFAULT_JOBS_CATEGORIES;

export function normalizeGroupKey(group?: string): "business" | "consulting" | "events" | "jobs" | null {
    if (!group) return null;
    const g = group.trim().toLowerCase().replace(/[_\s-]+/g, "");
    if (g.includes("business")) return "business";
    if (g.includes("consult")) return "consulting";
    if (g.includes("event")) return "events";
    if (g.includes("job")) return "jobs";
    return null;
}

function cloneCategoriesDict(source: CategoriesDict): CategoriesDict {
    const copy: CategoriesDict = {};
    for (const [key, entries] of Object.entries(source)) {
        copy[key] = (entries || []).map((entry) => {
            if (typeof entry === "string") return entry;
            return {
                label: entry.label,
                subSubcategories: Array.isArray(entry.subSubcategories) ? [...entry.subSubcategories] : [],
            };
        });
    }
    return copy;
}

export function sortCategoriesDict(source: CategoriesDict): CategoriesDict {
    const sorted: CategoriesDict = {};
    const sortedKeys = Object.keys(source).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    for (const key of sortedKeys) {
        const entries = source[key] || [];
        const sortedEntries = [...entries].sort((a, b) => {
            const labelA = getSubLabel(a);
            const labelB = getSubLabel(b);
            return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
        }).map((entry) => {
            if (typeof entry === "string") return entry;
            return {
                label: entry.label,
                subSubcategories: Array.isArray(entry.subSubcategories)
                    ? [...entry.subSubcategories].sort((a, b) =>
                          a.localeCompare(b, undefined, { sensitivity: "base" })
                      )
                    : [],
            };
        });

        sorted[key] = sortedEntries;
    }

    return sorted;
}

export function mergeDirectoryCategories(dbDocs: DirectoryCategoryDoc[]): {
    business: CategoriesDict;
    consulting: CategoriesDict;
    events: CategoriesDict;
    jobs: CategoriesDict;
    categoryMetadataMap: Record<string, DirectoryCategoryDoc>;
} {
    const business = cloneCategoriesDict(DEFAULT_BUSINESS_CATEGORIES);
    const consulting = cloneCategoriesDict(DEFAULT_CONSULTING_CATEGORIES);
    const events = cloneCategoriesDict(DEFAULT_EVENTS_CATEGORIES);
    const jobs = cloneCategoriesDict(DEFAULT_JOBS_CATEGORIES);

    const dicts = { business, consulting, events, jobs };
    const categoryMetadataMap: Record<string, DirectoryCategoryDoc> = {};

    dbDocs.forEach((doc) => {
        const groupKey = normalizeGroupKey(doc.parentCategory || doc.group);
        if (!groupKey) return;

        const targetDict = dicts[groupKey];
        if (!targetDict) return;

        const categoryName = (doc.categoryName || doc.category || "").trim();
        if (!categoryName) return;

        const subcategory = (doc.subcategory || "").trim();
        const subSubcategory = (doc.subSubcategory || "").trim();
        const isInactive = (doc.status || "Active").toLowerCase() === "inactive";

        // Store metadata keyed by ID and by paths
        if (doc.id) {
            categoryMetadataMap[doc.id] = doc;
        }
        categoryMetadataMap[`${groupKey}:${categoryName}`] = doc;
        if (subcategory && subcategory !== "-") {
            categoryMetadataMap[`${groupKey}:${categoryName}:${subcategory}`] = doc;
            if (subSubcategory && subSubcategory !== "-") {
                categoryMetadataMap[`${groupKey}:${categoryName}:${subcategory}:${subSubcategory}`] = doc;
            }
        }

        // Handle inactive items
        if (isInactive) {
            if (!subcategory || subcategory === "-") {
                delete targetDict[categoryName];
                return;
            }

            if (targetDict[categoryName]) {
                if (!subSubcategory || subSubcategory === "-") {
                    targetDict[categoryName] = targetDict[categoryName].filter(
                        (entry) => getSubLabel(entry).toLowerCase() !== subcategory.toLowerCase()
                    );
                } else {
                    targetDict[categoryName] = targetDict[categoryName].map((entry) => {
                        if (typeof entry !== "string" && entry.label.toLowerCase() === subcategory.toLowerCase()) {
                            return {
                                ...entry,
                                subSubcategories: entry.subSubcategories.filter(
                                    (ss) => ss.toLowerCase() !== subSubcategory.toLowerCase()
                                ),
                            };
                        }
                        return entry;
                    });
                }
            }
            return;
        }

        // Ensure category exists
        if (!targetDict[categoryName]) {
            targetDict[categoryName] = [];
        }

        if (!subcategory || subcategory === "-") {
            return;
        }

        // Add subcategory / sub-subcategory
        const currentEntries = targetDict[categoryName];
        const existingEntryIndex = currentEntries.findIndex(
            (entry) => getSubLabel(entry).toLowerCase() === subcategory.toLowerCase()
        );

        if (!subSubcategory || subSubcategory === "-") {
            if (existingEntryIndex === -1) {
                currentEntries.push(subcategory);
            }
        } else {
            if (existingEntryIndex === -1) {
                currentEntries.push({
                    label: subcategory,
                    subSubcategories: [subSubcategory],
                });
            } else {
                const existing = currentEntries[existingEntryIndex];
                if (typeof existing === "string") {
                    currentEntries[existingEntryIndex] = {
                        label: existing,
                        subSubcategories: [subSubcategory],
                    };
                } else {
                    if (!existing.subSubcategories.some((ss) => ss.toLowerCase() === subSubcategory.toLowerCase())) {
                        existing.subSubcategories.push(subSubcategory);
                    }
                }
            }
        }
    });

    return {
        business: sortCategoriesDict(business),
        consulting: sortCategoriesDict(consulting),
        events: sortCategoriesDict(events),
        jobs: sortCategoriesDict(jobs),
        categoryMetadataMap,
    };
}
