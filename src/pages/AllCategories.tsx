import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Building2, Users, Search, ExternalLink, Calendar, Briefcase, X, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/firebase";
import { collection, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { AutoCarousel } from "@/components/ui/auto-carousel";

//Types 
export type SubcategoryEntry = string | { label: string; subSubcategories: string[] };
export type CategoriesDict = Record<string, SubcategoryEntry[]>;

const getSubLabel = (entry: SubcategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
    typeof entry !== "string";

export const BUSINESS_CATEGORIES: CategoriesDict = {
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

export const CONSULTING_CATEGORIES: Record<string, string[]> = {
    "Advisory Board": ["Clinical", "CMC", "Labeling", "Regulatory", "Target Selection"],
    "Analytical Comparability": [], "Analytical Methods": ["Advanced Therapies", "Artificial Intellidence", "Bioinformatics", "Cell Banks", "Cell Lines", "Cell Therapies", "Exipients", "Genetic Stability", "Immunoassays", "Laboratory systems & design", "Non-Sterile Products", "Novel Therapies", "Others", "Potency & Bioassays", "Raw Materials", "RNA Therapies", "Small Molecules", "Sterile Products", "Virus Based Therapies"],
    "Artificial Intelligence": [], "Asset Evaluation": [],
    "Auditing": ["Clinical Sites", "GLP", "GMP", "ISO Certification", "Remediation"],
    "Automation": ["Equipment", "Facility", "Laboratory", "Manufacturing", "Utilities", "Warehouse"],
    "Bioinformatics": [], "Biostatistics & Data Science": [], "Clinical Trials & Research": [], "Cold Chain Solutions": [],
    "Commercialization": ["Commercial Strategy", "Competitive Intelligence", "Market Access & Health Technology", "Market Research", "Pricing", "Sales & Marketing"],
    "Compatibility (In-Use) Studies": [], "Consent Decree & Warning Letters": [], "Contract Manufacturing Site Management": [], "Contract Research Site Management": [], "Due Diligence": [],
    "Engineering": ["Computer Systems", "Equipment", "Facility", "Laboratory Systems & Design", "Process", "Warehouse"],
    "Environmental Impact Assessments": [], "Environmental Monitoring & Testing": [], "Extractable & Leachable Studies": [],
    "Facility Design & Qualifications": ["Drug Product Manufacturing", "Drug Substance Manufacturing", "Filling", "Laboratory", "Other", "Packaging", "Storage", "Utilities", "Warehouse", "Water Purification"],
    "Facility Maintenance & Support": [], "Formulation Development": [], "Gene Editing Based Therapies": [], "Genomics": [], "Genomics & Related Services": [], "Global Sample Logistics": [], "GMO Applications": [], "GMP/GXP Training": [], "Import & Export Services": [], "In Country Representative": [], "In Country Testing": [], "Insilico Assessments": [], "Integrated Control Strategy": [], "Interim Functional Leadership": [],
    "Key Opinion Leaders": ["Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthamalmology", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women's Health"],
    "Labeling & Translation": [], "Labeling Requirements & Design": [],
    "Legal/IP Services": ["Africa", "Asia", "Australia", "Europe", "Middle East", "New Zealand", "North America", "South America", "Switzerland", "UK"],
    "Lot Release Program": [], "Manufacturing Capacity Planning": [],
    "Material Qualification": ["Cell & Virus Banks", "Lipids", "Non-GMP", "Novel Exipients", "Polymers", "Raw Materials", "Solvents", "Speciality Materials"],
    "Material Sciences": [], "Medical Affairs": [],
    "Medical Devices": ["Ablation Therapy", "Audits", "Cardiovasular", "CE Mark", "Central Nervous System", "Clinical Trials", "Companion Diagnostics", "Consumer Health", "Critical Care", "Data Management", "Dermatology", "Design", "Development", "Diagnostics", "Imaging", "Implantable", "In vitro Diagnostics", "Infectious Diseases", "ISO Certifications", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Model Selection", "Ophthalmology", "Pharmacovigilance", "Post Market Surveillance", "Project Management", "Protocol Writing", "Quality Systems", "Respiratory", "Single Use", "Software for Devices", "SOPs Draftin g& Review", "Surgical Devices", "Trial Planning & Management", "Validation", "Vendor Management", "Women's Health"],
    "Medical Devices In Vitro Diagnostics": [], "Medical Writing": [], "Microbial Control Strategy": [], "Other": [], "Personalized Medicines": [], "Pharmacology & Toxicology": [], "Pharmacovigilance": [], "Post Market Surveillance": [], "Process Characterization Studies": [], "Process Development": [],
    "Project & Program Management": ["Automation", "Clinical", "CMC", "Equipment", "Facility", "Non-Clinical", "Portfolio Assessment & Prioritization", " Timeline Development & Analysis"],
    "Quality & Compliance": ["In Country Representative", "QMS Design & Review", "QP Support", "Quality Assurance", "SOP Review & Writing", "Supplier Oversight", "supplier Qualification"],
    "Quality Control": ["Other", "QC Lab Oversight", "QC Strategy"], "Radiolabeled Materials": [],
    "Radiopharmaceuticals": ["Analytical", "Clinical Research", "Development", "Manufacturing", "Pre-Clinical Research"],
    "Reference Standards": [],
    "Regulatory Sciences": ["Advanced Therapies", "Africa", "Asia", "Australia", "Biosimilars", "Cell & Gene Therapies", "Clinical Holds", "Clinical Strategy", "CMC Strategy", "Combination Products", "Complete Response", "CTD Sections Authoring & Review (Clinical)", "CTD Sections Authoring & Review (Non- Clinical)", "CTD Sections Authoring & Review (CMC)", "Due Diligence", "Europe", "FDA Advisory Committee", "Gene Editing Based Therapies", "Health Authority Meetings", "Human Cell Based Therapies", "In Country Agent & Representative", "Medical Devices", "Middle East", "New Zealand", "North America", "Novel Therapies", "Oncolytic Virus Based Therapies", "Other", "Personalized Medicines", "Preclinical & Nonclinical Stratgy", "Protocol Review & Writing", "Radiopharmaceuticals", "RNA Based Therapies", "Small Molecules", "South America", "Sterile Products", "Study & Protocol Design", "Switzerland", "Traditional Vaccines", "UK", "Vaccines (Newer Technologies)", "Viral Vector Based Therapies"],
    "Research & Development": ["Audits", "Biostats", "Clinical Development", "Contract Support", "Data Management", "EU QPPV", "Lead Optimization", "Literature Screening", "Local Contact", "Non-Clinical Development", "Patient Support", "Pharmacovigilance", "Post Marketing Surveillance", "Pre-Clinical Research", "Project Management", "Protocol Writing", "Real World Evidence", "Site Qualification & Management", "Study Design", "Target & Lead Optimization", "Translational Sciences", "Trial Planning & Management", "Vendor Management", "Vendor Selection"],
    "Risk Assessments": ["Environmental Controls", "Exipients", "Facility", "Formulation", "Impurity", "Material", "Microbial Controls", "Process"],
    "Scientific Advisory": [], "Specialty Services": [], "Specification Assessment": [],
    "Stability Strategy": ["-20C", "-60C", "2-8C", "Ambient Conditions", "Ambient Conditions/High RH", "Ultra Cold"],
    "Stability Studies": ["Accelerated", "Advanced Therapies", "Biologics", "Comparability", "Forced Degradation", "Novel Therapies", "Photostability", "Rare Diseases", "RNA Based Products", "Small Molecules", "Virus Based Products"],
    "Statistical Analysis": [], "Statistical Analysis CMC": [], "Sterile Filter Validation Or Qualification": [],
    "Supply Chain Solutions": ["Cold Chain Solutions", "Speciality Services"], "Target Selection": [],
    "Technical Writing": ["Clinical", "CMC", "Medical Writing", "Non-Clinical"],
    "Technology & Software": [], "Technology Transfer & Process Development": [],
    "Therapeutic Areas": ["Cardiology", "Dermatology", "Endocrinology", "Epidemiology", "Gastroenterology", "Hematology", "Hepatology", "Infectious Diseases", "Men's Health", "Metabolic & Endocrine", "Nephrology", "Neurology & Psychiatry", "Oncology", "Ophthalmology", "Other", "Pediatrics", "Respiratory", "Rheumatology", "Urology", "Women's Health"],
    "Translations": [], "Translators": [],
    "Validation": ["Automation", "Cleaning", "Computer Systems", "Environmental Controls", "Equipment", "Facility", "Laboratory Systems", "Master Plans", "Method", "Other", "Process", "Protocol & Report Writing", "Shipping"],
    "Viral Safety & Clearance Studies": [], "Warehouse Controls": ["Temperature Mapping Studies"], "Water Purification Systems": []
};

export const EVENTS_CATEGORIES: Record<string, string[]> = {
    "AAPS (American Association Of Pharmaceutical Scientists)": [], "Advanced & Next Generation Therapies": [], "Analytical Development & Testing": [], "Analytical Methods": [], "Antibodies & Antibody Conjugates": [], "Artificial Intelligence, Bioinformatics & Technology": [], "Aseptic Technologies": [], "Bioassays": [], "Biomarkers & Diagnostics": [], "Biomaterials & Biodevices": [], "Biosimilars": [], "Biotechnology": [], "Bispecifics": [], "Building Systems & Controls": [], "CASSS": [], "Cell & Gene Therapy": [], "Chemistry Manufacturing & Controls (CMC)": [], "Clinical Research & Development": [], "Clinical Trials & Research": [], "Comparability": [], "Continuous Manufacturing/PAT/Real Time Quality": [], "Dermatology": [], "DIA (Drug Information Association)": [], "Diabetes & Cardiovascular Diseases": [], "Digital Innovation In Health Care": [], "Drug Discovery & Development": [], "Drug Safety": [], "Epidemiology": [], "Formulation & Drug Delivery": [], "Gastroenterology": [], "Gene Editing": [], "Genomics": [], "GMP Facilities": [], "Good Manufacturing Practices (GMPs)": [], "Health Care Conference": [], "Health Policy": [], "Health Technology Assessment": [], "Hematology": [], "Hepatology": [], "Higher Order Structure": [], "ICH Conferences": [], "Infectious Diseases": [], "Intellectual Property": [], "ISPE (International Society For Pharmaceutical Engineering)": [], "Labelling": [], "Laboratory Equipment": [], "Manufacturing & Technical Operations": [], "Manufacturing Equipment": [], "Market Access": [], "Marketing & Sales": [], "Mass Spectrometry": [], "Materials, Reagents & Excipients": [], "Medical Affairs": [],
    "Medical Devices": ["Abilation Therapy", "Bispecifics", "Cardiovascular", "Central Nervous System", "Companion Diagnostics", "Consumer Health", "Critical Care", "Dermatology", "Diagnostics", "Gene Editing", "Imaging", "Implanatable", "In Vitro Diagnostics", "Infectious Diseases", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Nucleic Acid Based Therapies", "Ophthalmology", "Respiratory", "RNA Based Therapies", "Single Use", "Software for Devices", "Surgical Devices", "Women's Health"],
    "Medical Equipment": [], "Medicinal & Pharmaceutical Chemistry": [], "Men's Health": [], "Metabolic & Endocrine": [], "Microbiology, Virology, Immunology & Infectious Diseases": [], "Molecular & Precision Medicine": [], "Nephrology": [], "Neurology & Psychiatry": [], "Nucleic Acid Based Therapies": [], "Oncology": [], "Other": [], "Patient Recruitment & Engagement": [], "Pediatrics": [], "Pharmaceutical Law": [], "Pharmaceutical Science": [], "Pharmaceuticals": [], "Pharmacology & Toxicology": [], "Potency Assays": [], "Pre-Clinical Research & Development": [], "Pricing & Health Technology": [], "Quality & Compliance": [], "Radiopharmaceuticals": [], "Rare Disease & Orphan Drug Products": [], "Regulations & Guidances": [], "Regulatory Affairs": [], "Research & Innovation": [], "Respiratory": [], "Rheumatology": [], "Risk Management & Pharmacovigilance": [], "RNA Based Therapies": [], "Stability": [], "Stem Cell & Regenerative Medicine": [], "Sterile Drug Products": [], "Supply Chain & Logistics": [], "Tools And Technology": [], "Translational Sciences": [], "Urology": ["<= -60C"], "Vaccines, Immunology & Antibiotics": [], "Validation": [], "Viral Vectors": [], "Well Characterized Biologics (WCBP)": [], "Women's Health": []
};

export const JOBS_CATEGORIES: Record<string, string[]> = {
    "Administration": [], "Analytical Sciences": [], "Artificial Intelligence & Bioinformatics": [], "Business Development": [], "Clinical Operations": [], "Clinical Research & Development": [], "Drug Discovery": [], "Engineering": [], "Facilities & Building Systems": [], "Finance": [], "Formulation & Development": [], "Health Technology & Market Access": [], "Human Resources & People Management": [], "Information Technology": [], "Legal": [], "Manufacturing & Technical Operations": [], "Manufacturing Sciences & Technology": [], "Market Access": [], "Marketing": [], "Other": [], "Pharmacology": [], "Pre Clinical Research & Development": [], "Product Development": [], "Project Or Program Management": [], "Quality & Compliance": [], "Quality Control": [], "Regulatory": [], "Sales": [], "Toxicology": [], "Translational Sciences": [], "Validation": []
};

const HEALTH_AUTHORITIES = [
    { country: "Afghanistan", url: "https://www.afda.gov.af/en/guidelines" }, { country: "Africa", url: "https://amrh.nepad.org/amrh-countries" }, { country: "Albania", url: "https://shendetesia.gov.al/" },
    { country: "Algeria", url: "https://ghdx.healthdata.org/organizations/ministry-health-population-and-hospital-reform-algeria" }, { country: "Andorra", url: "https://ghdx.healthdata.org/organizations/ministry-health-and-welfare-andorra" }, { country: "Angola", url: "https://www.trade.gov/country-commercial-guides/angola-healthcare#:~:text=ARMED's%20main%20objectives%20are%20to,WHO%20norms%20and%20Angolan%20regulations." },
    { country: "Antigua and Barbuda", url: "https://health.gov.ag/" }, { country: "Argentina", url: "https://www.argentina.gob.ar/anmat/anmat-en/what-anmat" }, { country: "Armenia", url: "http://www.pharm.am/index.php/en/" },
    { country: "Australia", url: "https://www.tga.gov.au/" }, { country: "Austria", url: "https://www.basg.gv.at/en/" }, { country: "Azerbaijan", url: "https://www.unodc.org/cld/uploads/res/document/aze/2006/law_of_the_republic_of_azerbaijan_on_medicinal_products_html/Law_on_Medicines.pdf" },
    { country: "Bahrain", url: "https://www.moh.gov.bh/?lang=en" }, { country: "Bangladesh", url: "https://www.dgdagov.info/" }, { country: "Barbados", url: "https://www.health.gov.bb/" }, { country: "Belarus", url: "https://minzdrav.gov.by/en/" },
    { country: "Belgium", url: "https://www.famhp.be/en" }, { country: "Belize", url: "https://www.health.gov.bz/" }, { country: "Benin", url: "https://sante.gouv.bj/" }, { country: "Bhutan", url: "https://moh.gov.bt/" }, { country: "Bolivia", url: "https://www.minsalud.gob.bo/" }, { country: "Bosnia", url: "http://80.65.161.138/english/ministarstva/zdravstvo.php" },
    { country: "Botswana", url: "https://www.moh.gov.bw/regulatory.html" }, { country: "Brazil", url: "https://www.gov.br/anvisa/acl_users/credentials_cookie_auth/require_login?came_from=https%3A//www.gov.br/anvisa/pt-br/english" }, { country: "Brunei", url: "https://moh.gov.bn/" }, { country: "Bulgaria", url: "https://www.bda.bg/bg/%D0%B7%D0%B0-%D0%B8%D0%B0%D0%BB" },
    { country: "Burkina Faso", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Burundi", url: "https://weadapt.org/organisation/moh-burundi/" }, { country: "Cabo Verde", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Cambodia", url: "https://moh.gov.kh/kh/home" }, { country: "Cameroon", url: "https://www.minsante.cm/site/?q=en" },
    { country: "Canada", url: "https://www.canada.ca/en/health-canada/corporate/about-health-canada/branches-agencies/health-products-food-branch.html" }, { country: "Central African Republic", url: "https://africacdc.org/people/pierre-somse/" }, { country: "Chad", url: "https://www.nepad.org/countries/comoros" }, { country: "Chile", url: "http://www.ispch.cl/" }, { country: "China", url: "https://subsites.chinadaily.com.cn/nmpa/NMPA.html" },
    { country: "Colombia", url: "https://www.invima.gov.co/" }, { country: "Comoros", url: "https://www.nepad.org/countries/comoros" }, { country: "Congo", url: "https://www.nepad.org/countries/comoros" }, { country: "Costa Rica", url: "https://www.ministeriodesalud.go.cr/index.php" }, { country: "Côte d'Ivoire", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Croatia", url: "https://www.eunethta.eu/miz/" },
    { country: "Cuba", url: "https://ghdx.healthdata.org/organizations/ministry-public-health-cuba" }, { country: "Cyprus", url: "https://www.gov.cy/moh/" }, { country: "Czech Republic", url: "https://www.sukl.gov.czindex.php/?lang=2" }, { country: "Denmark", url: "https://laegemiddelstyrelsen.dk/en" }, { country: "Djibouti", url: "https://ghdx.healthdata.org/organizations/ministry-health-djibouti" },
    { country: "Dominica", url: "https://health.gov.dm/" }, { country: "Dominican Republic", url: "https://msp.gob.do/quienes-somos/" }, { country: "Dubai", url: "https://dha.gov.ae/en/AboutUs" }, { country: "East Timor", url: "https://customs.gov.tl/other-gov-agencies/ministry-of-health/" }, { country: "Ecuador", url: "https://www.salud.gob.ec/" }, { country: "Egypt", url: "https://amrh.nepad.org/amrh-countries/egypt" },
    { country: "El Salvador", url: "https://www.salud.gob.sv/" }, { country: "Eritrea", url: "https://healthresearchwebafrica.org.za/en/eritrea/institution_61" }, { country: "Estonia", url: "https://ravimiamet.ee/en" }, { country: "Eswatini", url: "https://www.gov.sz/index.php/ministries-departments/ministry-of-health" }, { country: "Ethiopia", url: "https://www.efda.gov.et/" }, { country: "Europe (European Commission)", url: "https://health.ec.europa.eu/medicinal-products/eudralex_en" },
    { country: "Europe (European Medicines Agency)", url: "https://www.ema.europa.eu/en/homepage" }, { country: "Fiji", url: "https://www.health.gov.fj/" }, { country: "Finland", url: "https://fimea.fi/en/frontpage" }, { country: "France", url: "https://gnius.esante.gouv.fr/en/players/player-profiles/french-national-agency-safety-medicines-and-health-products-ansm" }, { country: "Gabon", url: "https://amrh.nepad.org/amrh-countries/gabon" },
    { country: "Gambia", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Georgia", url: "https://cratia.com/en/countries/gruziya/registracziya-lekarstvennyh-sredstv/" }, { country: "Germany (Drugs & Medical Devices)", url: "https://www.bfarm.de/EN/Home/_node.html" }, { country: "Germany (Vaccines & Biomedicines)", url: "https://www.pei.de/EN/service/service-node.html" }, { country: "Ghana", url: "https://www.moh.gov.gh/" },
    { country: "Greece", url: "https://www.eof.gr/en/" }, { country: "Grenada", url: "https://www.gov.gd/index.php/health" }, { country: "Guatemala", url: "https://mspas.gob.gt/" }, { country: "Guyana", url: "https://health.gov.gy/" }, { country: "Haiti", url: "https://www.fondation-merieux.org/en/news/the-haiti-ministry-of-public-health-and-population-of-haiti-launches-its-first-national-health-research-policy/" }, { country: "Honduras", url: "https://ghdx.healthdata.org/organizations/ministry-health-honduras" },
    { country: "Hong Kong", url: "https://www.dh.gov.hk/english/index.html" }, { country: "Hungary", url: "http://www.ogyi.hu/" }, { country: "Iceland", url: "https://www.lyfjastofnun.is/" }, { country: "India", url: "https://cdsco.gov.in/opencms/opencms/en/Home/" }, { country: "Indonesia", url: "https://www.kemkes.go.id/id/home" }, { country: "Iran", url: "https://irangov.ir/ministry-of-health-and-medical-education" }, { country: "Iraq", url: "https://gov.krd/moh-en/" },
    { country: "Ireland", url: "https://www.hpra.ie/" }, { country: "Israel", url: "https://www.gov.il/en/departments/ministry_of_health/govil-landing-page" }, { country: "Italy", url: "https://www.iss.it/" }, { country: "Jamaica", url: "https://www.moh.gov.jm/" }, { country: "Japan", url: "https://www.pmda.go.jp/english/index.html" }, { country: "Jordon", url: "https://www.moh.gov.jo/Default/En" }, { country: "Kazakhstan", url: "https://www.gov.kz/memleket/entities/dsm?lang=en" },
    { country: "Kenya", url: "https://www.health.go.ke/" }, { country: "Kiribati", url: "https://mhms.gov.ki/" }, { country: "Korea", url: "http://www.mfds.go.kr/eng/index.do" }, { country: "Kosovo", url: "https://msh.rks-gov.net/" }, { country: "Kuwait", url: "https://staging74791946.pharmasocio.com/category-details/Ministry%20of%20Health" }, { country: "Kyrgyzstan", url: "https://med.kg/?locale=en" }, { country: "Laos", url: "https://ghdx.healthdata.org/organizations/ministry-health-laos" },
    { country: "Latvia", url: "https://www.zva.gov.lv/en" }, { country: "Lebanon", url: "https://www.moph.gov.lb/en/Pages/9/1024/the-ministry" }, { country: "Liberia", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Libya", url: "https://amrh.nepad.org/" }, { country: "Liechtenstein", url: "https://www.llv.li/de/landesverwaltung/amt-fuer-gesundheit" }, { country: "Lithuania", url: "https://vvkt.lrv.lt/lt/" }, { country: "Luxembourg", url: "https://m3s.gouvernement.lu/en.html" },
    { country: "Madagascar", url: "http://www.sante.gov.mg/ministere-sante-publique/" }, { country: "Malawi", url: "https://www.health.gov.mw/" }, { country: "Malaysia", url: "https://www.npra.gov.my/index.php/en/" }, { country: "Maldives", url: "https://health.gov.mv/en" }, { country: "Mali", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Malta", url: "https://medicinesauthority.gov.mt/" }, { country: "Marshall Islands", url: "https://rmihealth.org/" },
    { country: "Mauritius", url: "https://health.govmu.org/health/" }, { country: "Mexico", url: "https://www.gob.mx/cofepris" }, { country: "Micronesia", url: "https://hsa.gov.fm/health-human-affairs/" }, { country: "Moldova", url: "https://www.ms.gov.md/en/" }, { country: "Monaco", url: "https://en.gouv.mc/Government-Institutions/The-Government/Ministry-of-Health-and-Social-Affairs" }, { country: "Mongolia", url: "https://www.moh.gov.mn/" },
    { country: "Montenegro", url: "https://www.gov.me/en/mzd" }, { country: "Morocco", url: "http://www.sante.gov.ma/" }, { country: "Mozambique", url: "https://www.mtapsprogram.org/where-we-work/mozambique/" }, { country: "Myanmar (Burma)", url: "https://www.fda.gov.mm/?page_id=13" }, { country: "Namibia", url: "https://mhss.gov.na/" }, { country: "Nauru", url: "http://naurugov.nr/government/departments/department-of-health-and-medicinal-service.aspx" },
    { country: "Nepal", url: "https://dda.gov.np/" }, { country: "Netherlands", url: "https://english.cbg-meb.nl/" }, { country: "New Zealand", url: "https://www.medsafe.govt.nz/" }, { country: "Nicaragua", url: "https://www.minsa.gob.ni/" }, { country: "Niger", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Nigeria", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "North Macedonia", url: "https://is.gov.mk/en/inspection_services/%D0%B0%D0%B3%D0%B5%D0%BD%D1%86%D0%B8%D1%98%D0%B0-%D0%B7%D0%B0-%D0%BB%D0%B5%D0%BA%D0%BE%D0%B2%D0%B8/" },
    { country: "Norway", url: "https://www.dmp.no/en" }, { country: "Oman", url: "https://www.moh.gov.om/en/web/dgpadc/introduction" }, { country: "Pakistan", url: "https://www.dra.gov.pk/therapeutic-goods/drugs/application-processes/" }, { country: "Palau", url: "https://www.palaugov.pw/executive-branch/ministries/health/" }, { country: "Palestine", url: "http://mhpss.ps/en/organization/state-of-palestine-ministry-of-health/rDVOwnP4SK8=" }, { country: "Panama", url: "https://www.minsa.gob.pa/informacion-salud/regulacion-de-investigacion-para-la-salud" },
    { country: "Papua New Guinea", url: "https://www.health.gov.pg/" }, { country: "Paraguay", url: "https://www.mspbs.gov.py/index.php" }, { country: "Peru", url: "https://www.digemid.minsa.gob.pe/webDigemid/" }, { country: "Philippines", url: "https://ncroffice.doh.gov.ph/" }, { country: "Poland", url: "https://www.nil.gov.pl/en/about-us/" }, { country: "Portugal", url: "https://www.infarmed.pt/" }, { country: "Qatar", url: "https://www.moph.gov.qa/english/Pages/Error.aspx?requestUrl=https://www.moph.gov.qa/english/derpartments/policyaffairs/pdc/Pages/default.aspx" },
    { country: "Rawanda", url: "https://www.moh.gov.rw/" }, { country: "Romania", url: "https://www.ms.ro/en/" }, { country: "Russia", url: "https://www.regmed.ru/en/about/centre/#:~:text=The%20FSBI%20'SCEEMP'%20employs%20highly,Rules%20of%20Marketing%20Authorisation%20and" }, { country: "Saint Kitts and Nevis", url: "https://www.gov.kn/prime-ministers-office-ministry-of-finance-national-security-citizenship-and-immigration-health-and-social-security/" },
    { country: "Saint Vincent and Grenadines", url: "https://www.gov.vc/index.php/media-center/846-ministry-of-health-wellness-and-the-environment-receives-donation-of-medical-supplies-and-equipment" }, { country: "Samoa", url: "https://www.health.gov.ws/" }, { country: "San Marino, Ministry of Health", url: "https://eurohealthobservatory.who.int/countries/san-marino" }, { country: "Sao Tome and Principe", url: "https://ghdx.healthdata.org/organizations/ministry-health-sao-tome-and-principe" },
    { country: "Saudi Arabia", url: "https://www.sfda.gov.sa/en" }, { country: "Senegal", url: "https://www.sante.gouv.sn/" }, { country: "Serbia", url: "https://www.zdravlje.gov.rs/" }, { country: "Sierra Leone", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Singapore", url: "https://www.hsa.gov.sg/" }, { country: "Slovak Republic", url: "https://www.sukl.sk/hlavna-stranka-1/english-version/about-sidc?page_id=259" },
    { country: "Slovenia", url: "https://www.jazmp.si/en/" }, { country: "Solomon Islands", url: "https://solomons.gov.sb/ministry-of-health-medical-services/" }, { country: "Somalia", url: "https://moh.gov.so/en/" }, { country: "South Africa", url: "https://www.health.gov.za/" }, { country: "Spain", url: "https://www.aemps.gob.es/" }, { country: "Spanish", url: "https://www.aemps.gob.es/s" }, { country: "Sri Lanka", url: "https://www.nmra.gov.lk/?ui=desktop" }, { country: "St. Lucia", url: "https://www.govt.lc/news/guidelines-on-medicines-and-prescriptions" },
    { country: "Sudan", url: "https://amrh.nepad.org/amrh-countries/sudan" }, { country: "Suriname", url: "https://www.preventionweb.net/organization/ministry-health-republic-suriname" }, { country: "Swaziland", url: "https://staging74791946.pharmasocio.com/" }, { country: "Sweden", url: "https://www.lakemedelsverket.se/english" }, { country: "Switzerland", url: "https://www.swissmedic.ch/swissmedic/en/home.html" }, { country: "Syria", url: "https://egov.sy/cat/en/88/0/Health.html" }, { country: "Taiwan", url: "https://www.fda.gov.tw/eng/" },
    { country: "Tanzania", url: "https://www.moh.go.tz/" }, { country: "Thailand", url: "https://en.fda.moph.go.th/" }, { country: "Tonga", url: "https://ago.gov.to/cms/images/LEGISLATION/PRINCIPAL/2001/2001-0003/TherapeuticGoodsAct_3.pdf?zoom_highlight=therapeutic+goods+act" }, { country: "Togo", url: "https://www.wahooas.org/web-ooas/en/pays-membres/cabo-verde" }, { country: "Trinidad and Tobago", url: "https://health.gov.tt/" }, { country: "Tunisia", url: "http://www.dpm.tn/" }, { country: "Turkey", url: "https://www.saglik.gov.tr/" },
    { country: "Turkmenistan", url: "https://www.saglykhm.gov.tm/en" }, { country: "Tuvalu", url: "https://faolex.fao.org/docs/pdf/tuv176137.pdf" }, { country: "UAE", url: "https://mohap.gov.ae/en/services" }, { country: "Uganda", url: "https://www.health.go.ug/programs/ministry-departments/departments-and-divisions/" }, { country: "UK", url: "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency" }, { country: "Ukraine", url: "https://cratia.ua/en/service/registration-of-medicines-pharmacovigilance-and-gmp/" },
    { country: "Uruguay", url: "https://www.gub.uy/ministerio-salud-publica/" }, { country: "Uzbekistan", url: "https://m.en.regmed.uz/" }, { country: "Vanuatu", url: "https://moh.gov.vu/index.php/docspp/principal-pharmacist" }, { country: "Venezuela", url: "https://ghdx.healthdata.org/organizations/ministry-health-and-social-development-venezuela" }, { country: "Yemen", url: "https://yementradeportal.com/en/yemen-supreme-board-of-drugs-sbd-2/" }, { country: "Zambia", url: "https://www.zamra.co.zm/" }, { country: "Zimbabwe", url: "https://www.mohcc.gov.zw/" }
];
const CATEGORY_CONFIG = {
    business: {
        title: "Business Offerings",
        description: "Explore curated life sciences providers, businesses, and expertise across specialized categories."
    },
    consulting: {
        title: "Consulting Services",
        description: "From established consulting firms to independent specialists, find the right partner to advance your project."
    },
    events: {
        title: "Events",
        description: "Whether you're an industry leader, emerging entrepreneur, or passionate researcher, stay connected to the conversations and ideas moving life sciences forward."
    },
    jobs: {
        title: "Jobs",
        description: "Explore opportunities aligned with your goals and take the next step in your life sciences journey."
    },
    compliance: {
        title: "Global Health Authority Sites",
        description: "Bid farewell to endless searches and fragmented information. Our platform serves as your compass, making navigation of health authority sites effortless and efficient."
    }
};
export default function AllCategories() {
    const { category } = useParams<{ category: string }>();
    const currentTab = category || "business";

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // ── All three levels are now arrays (multi-select) ──
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
    const [searchCountry, setSearchCountry] = useState("");
    const [healthAuthSearch, setHealthAuthSearch] = useState("");
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 30;

    useEffect(() => {
        setViewMode("grid");
        setCurrentPage(1);
        const fetchAllCategoriesData = async () => {
            setLoading(true);
            try {
                let docs: any[] = [];
                if (currentTab === "business") {
                    const q = query(collectionGroup(db, "businessOfferingsCollection"), where("active", "==", true));
                    const snap = await getDocs(q);
                    docs = snap.docs;
                } else if (currentTab === "consulting") {
                    const [servicesSnap, legacySnap] = await Promise.all([
                        getDocs(query(collection(db, "consultingServicesCollection"), where("active", "==", true))),
                        getDocs(query(collection(db, "consultingCollection"), where("active", "==", true))),
                    ]);
                    docs = [...servicesSnap.docs, ...legacySnap.docs];
                } else if (currentTab === "events") {
                    const q = query(collection(db, "eventsCollection"), where("active", "==", true));
                    const snap = await getDocs(q);
                    docs = snap.docs;
                } else if (currentTab === "jobs") {
                    const q = query(collection(db, "jobsCollection"), where("active", "==", true));
                    const snap = await getDocs(q);
                    docs = snap.docs;
                }

                if (docs.length > 0) {
                    // De-duplicate and only show records that are approved/live.
                    const deduped = new Map<string, any>();
                    docs.forEach((d: any) => {
                        const key = d.ref?.path || d.id;
                        if (!deduped.has(key)) {
                            deduped.set(key, { id: d.id, ...(d.data() as Record<string, any>) });
                        }
                    });
                    const approvedDocs = Array.from(deduped.values()).filter((doc: any) => !doc.status || doc.status === "Approved");
                    setData(approvedDocs);
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

    // ── Toggle for top-level categories (now an array) ──
    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
        setCurrentPage(1);
    };

    const toggleSubcategory = (sub: string) => {
        setSelectedSubcategories(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
        setCurrentPage(1);
    };

    const toggleSubSubcategory = (subSub: string) => {
        setSelectedSubSubcategories(prev =>
            prev.includes(subSub) ? prev.filter(s => s !== subSub) : [...prev, subSub]
        );
        setCurrentPage(1);
    };

    const toggleExpandCategory = (cat: string) => {
        setExpandedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const toggleExpandSubcategory = (subLabel: string) => {
        setExpandedSubcategories(prev =>
            prev.includes(subLabel) ? prev.filter(s => s !== subLabel) : [...prev, subLabel]
        );
    };

    const resetCategorySelection = () => {
        setSelectedCategories([]);
        setSelectedSubcategories([]);
        setSelectedSubSubcategories([]);
        setSearchCountry("");
        setViewMode("grid");
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedSubcategories([]);
        setSelectedSubSubcategories([]);
        setSearchCountry("");
        setCurrentPage(1);
    };

    const isMainCategoryTab = currentTab === "business" || currentTab === "consulting" || currentTab === "events" || currentTab === "jobs";
    const currentCategoriesDict = currentTab === "business" ? BUSINESS_CATEGORIES : currentTab === "consulting" ? CONSULTING_CATEGORIES : currentTab === "events" ? EVENTS_CATEGORIES : JOBS_CATEGORIES;
    const featuredHeading = currentTab === "business" ? "Featured Businesses/Services" : currentTab === "consulting" ? "Meet the Experts" : currentTab === "events" ? "Featured Events" : "Featured Jobs/Opportunities";
    const noFeaturedText = currentTab === "business" ? "No featured businesses available at the moment." : currentTab === "consulting" ? "No experts available at the moment." : currentTab === "events" ? "No featured events available at the moment." : "No featured jobs available at the moment.";

    const filteredHealthAuths = HEALTH_AUTHORITIES.filter((auth) =>
        auth.country.toLowerCase().includes(healthAuthSearch.toLowerCase())
    );

    // ── Filter logic: all three levels use array state ──
    const filteredBusinesses = data.filter((item) => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();

            const matches =
                item.businessName?.toLowerCase().includes(q) ||
                item.primaryName?.toLowerCase().includes(q) ||
                item.eventName?.toLowerCase().includes(q) ||
                item.jobTitle?.toLowerCase().includes(q) ||
                item.category?.toLowerCase().includes(q) ||
                (Array.isArray(item.categories) &&
                    item.categories.some((c: string) =>
                        c.toLowerCase().includes(q)
                    )) ||
                item.selectedGroup?.toLowerCase().includes(q) ||
                (Array.isArray(item.selectedSubcategories) &&
                    item.selectedSubcategories.some((s: string) =>
                        s.toLowerCase().includes(q)
                    )) ||
                (Array.isArray(item.selectedSubSubcategories) &&
                    item.selectedSubSubcategories.some((s: string) =>
                        s.toLowerCase().includes(q)
                    ));

            if (!matches) return false;
        }
        if (!isMainCategoryTab) return true;

        // Get item's categories - support both old format (category: string) and new format (selectedCategories: array)
        const itemCategories: string[] = Array.isArray(item.selectedCategories) && item.selectedCategories.length > 0
            ? item.selectedCategories
            : Array.isArray(item.categories) && item.categories.length > 0
                ? item.categories
                : item.category
                    ? [item.category]
                    : item.consultingCategory
                        ? [item.consultingCategory]
                        : item.eventCategory
                            ? [item.eventCategory]
                            : item.jobCategory
                                ? [item.jobCategory]
                                : [];

        // Category: item must match AT LEAST ONE selected category (OR logic across categories)
        // Check if any of the item's categories match any of the selected categories
        if (selectedCategories.length > 0) {
            const hasMatchingCategory = itemCategories.some(itemCat => selectedCategories.includes(itemCat));
            if (!hasMatchingCategory) {
                return false;
            }
        }

        // Subcategory: item can match ANY selected sub (OR logic)
        if (selectedSubcategories.length > 0) {
            const itemSubs: string[] = Array.isArray(item.selectedSubcategories) ? item.selectedSubcategories : [];
            const hasMatchingSubcategory = selectedSubcategories.some(sel => itemSubs.includes(sel));
            if (!hasMatchingSubcategory) return false;
        }

        // Sub-subcategory: item can match ANY selected sub-sub (OR logic)
        if (selectedSubSubcategories.length > 0) {
            const itemSubSubs: string[] = Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories : [];
            const hasMatchingSubSubcategory = selectedSubSubcategories.some(sel => itemSubSubs.includes(sel));
            if (!hasMatchingSubSubcategory) return false;
        }

        // Country search: check address string AND serviceCountries array
        if (searchCountry) {
            const q = searchCountry.toLowerCase();
            const inAddress = item.businessAddress?.toLowerCase().includes(q);
            const inCountries = Array.isArray(item.serviceCountries) &&
                item.serviceCountries.some((c: string) => c.toLowerCase().includes(q));
            if (!inAddress && !inCountries) return false;
        }

        return true;
    });

    const totalPages = Math.ceil(filteredBusinesses.length / itemsPerPage);
    const paginatedBusinesses = filteredBusinesses.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const featuredBusinesses = data.filter(item => {
        const addon = item.selectedAddon || item.featuredPlacement || "";
        const hasLegacyFeatureFlag = item.isFeatured && !addon;
        const isLandingSpotlight = addon === "landing_page" || addon === "both";
        if (!isLandingSpotlight && !hasLegacyFeatureFlag) return false;

        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();

        return (
            item.businessName?.toLowerCase().includes(q) ||
            item.primaryName?.toLowerCase().includes(q) ||
            item.eventName?.toLowerCase().includes(q) ||
            item.jobTitle?.toLowerCase().includes(q)
        );
    });
    // ── Sidebar: uses selectedCategories array everywhere ──
    const renderSidebarCategories = () => {
        if (currentTab !== "business") {
            return Object.entries(currentCategoriesDict as Record<string, string[]>).map(([cat, subs]) => {
                const isExpanded = expandedCategories.includes(cat);
                // FIX: check array, not single string
                const isSelectedCategory = selectedCategories.includes(cat);
                return (
                    <div key={cat} className="flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            {subs.length > 0 ? (
                                <button onClick={() => toggleExpandCategory(cat)} className="mt-1 flex-shrink-0">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                </button>
                            ) : (
                                <span className="w-4 h-4 flex-shrink-0" />
                            )}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={cat}
                                    checked={isSelectedCategory}
                                    // FIX: use toggleCategory, not setSelectedCategory
                                    onCheckedChange={() => toggleCategory(cat)}
                                />
                                <label htmlFor={cat} className="text-sm font-medium leading-none cursor-pointer">{cat}</label>
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
                                        <label htmlFor={`${cat}-${sub}`} className="text-sm font-light leading-none cursor-pointer text-muted-foreground">{sub}</label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            });
        }

        // Business tab — 3-level sidebar
        return Object.entries(currentCategoriesDict as CategoriesDict).map(([cat, subs]) => {
            const isExpanded = expandedCategories.includes(cat);
            // FIX: check array, not single string
            const isSelectedCategory = selectedCategories.includes(cat);
            return (
                <div key={cat} className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        {subs.length > 0 ? (
                            <button onClick={() => toggleExpandCategory(cat)} className="mt-1 flex-shrink-0">
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                        ) : (
                            <span className="w-4 h-4 flex-shrink-0" />
                        )}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={cat}
                                checked={isSelectedCategory}
                                // FIX: use toggleCategory, not setSelectedCategory
                                onCheckedChange={() => toggleCategory(cat)}
                            />
                            <label htmlFor={cat} className="text-sm font-medium leading-none cursor-pointer">{cat}</label>
                        </div>
                    </div>

                    {isExpanded && subs.length > 0 && (
                        <div className="pl-10 space-y-2 mb-2">
                            {subs.map((entry) => {
                                const subLabel = getSubLabel(entry);
                                const isNested = hasSubSub(entry);
                                const isSubExpanded = expandedSubcategories.includes(subLabel);
                                const isSubChecked = selectedSubcategories.includes(subLabel);

                                return (
                                    <div key={subLabel} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            {isNested ? (
                                                <button onClick={() => toggleExpandSubcategory(subLabel)} className="flex-shrink-0">
                                                    {isSubExpanded
                                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                                </button>
                                            ) : (
                                                <span className="w-3.5 h-3.5 flex-shrink-0" />
                                            )}
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${cat}-${subLabel}`}
                                                    checked={isSubChecked}
                                                    onCheckedChange={() => toggleSubcategory(subLabel)}
                                                />
                                                <label htmlFor={`${cat}-${subLabel}`} className="text-sm font-light leading-none cursor-pointer text-muted-foreground">
                                                    {subLabel}
                                                </label>
                                            </div>
                                        </div>

                                        {isNested && isSubExpanded && (
                                            <div className="pl-6 space-y-1.5 mt-1">
                                                {entry.subSubcategories.map((subSub) => (
                                                    <div key={subSub} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${cat}-${subLabel}-${subSub}`}
                                                            checked={selectedSubSubcategories.includes(subSub)}
                                                            onCheckedChange={() => toggleSubSubcategory(subSub)}
                                                        />
                                                        <label htmlFor={`${cat}-${subLabel}-${subSub}`} className="text-xs font-light leading-none cursor-pointer text-muted-foreground/80">
                                                            {subSub}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="bg-muted/40 border-b border-foreground/10 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        {CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.title || "Categories"}
                    </h1>

                    <p className="text-muted-foreground text-lg max-w-2xl">
                        {CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.description}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 mt-8 flex-1">
                <div className="w-full max-w-4xl mx-auto mb-10 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={`Search ${CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.title.toLowerCase()}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full"
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-[52px] px-6 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm hover:bg-foreground/5 flex items-center gap-3 min-w-[280px] justify-between transition-colors">
                                <div className="flex items-center gap-2">
                                    {currentTab === "business" && <Building2 className="w-5 h-5 text-primary" />}
                                    {currentTab === "consulting" && <Users className="w-5 h-5 text-primary" />}
                                    {currentTab === "events" && <Calendar className="w-5 h-5 text-primary" />}
                                    {currentTab === "jobs" && <Briefcase className="w-5 h-5 text-primary" />}
                                    {currentTab === "compliance" && <ShieldCheck className="w-5 h-5 text-primary" />}
                                    <span>{CATEGORY_CONFIG[currentTab as keyof typeof CATEGORY_CONFIG]?.title || "Categories"}</span>
                                </div>
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px] rounded-xl p-2 bg-background border-foreground/10 shadow-xl">
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/business" onClick={resetCategorySelection} className="flex items-center gap-3 w-full">
                                    <Building2 className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium text-base">Business Offerings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/consulting" onClick={resetCategorySelection} className="flex items-center gap-3 w-full">
                                    <Users className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium text-base">Consulting Services</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/events" onClick={resetCategorySelection} className="flex items-center gap-3 w-full">
                                    <Calendar className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium text-base">Events</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg mb-1 focus:bg-primary/10">
                                <Link to="/all-categories/jobs" onClick={resetCategorySelection} className="flex items-center gap-3 w-full">
                                    <Briefcase className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium text-base">Jobs</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="p-3 cursor-pointer rounded-lg focus:bg-primary/10">
                                <Link to="/all-categories/compliance" onClick={resetCategorySelection} className="flex items-center gap-3 w-full">
                                    <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium text-base">Global Health Authority Sites</span>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                {/* Active filter chips */}
                {isMainCategoryTab && (selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSubSubcategories.length > 0) && (
                    <div className="flex flex-wrap gap-2 mb-4 max-w-7xl mx-auto">
                        {selectedCategories.map(s => (
                            <span key={s} onClick={() => toggleCategory(s)} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground cursor-pointer hover:bg-primary/80 transition-colors">
                                {s} <X className="w-3 h-3" />
                            </span>
                        ))}
                        {selectedSubcategories.map(s => (
                            <span key={s} onClick={() => toggleSubcategory(s)} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors">
                                {s} <X className="w-3 h-3" />
                            </span>
                        ))}
                        {selectedSubSubcategories.map(s => (
                            <span key={s} onClick={() => toggleSubSubcategory(s)} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-secondary/10 text-secondary-foreground border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors">
                                {s} <X className="w-3 h-3" />
                            </span>
                        ))}
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                            Clear all
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading {currentTab}...</div>
                ) : isMainCategoryTab && viewMode === "grid" ? (
                    <div className="flex flex-col gap-16 pb-24 w-full max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(showAllCategories
                                ? Object.keys(currentCategoriesDict)
                                : Object.keys(currentCategoriesDict).slice(0, 11)
                            )
                                .filter(cat =>
                                    cat.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map((catName) => (<div
                                    key={catName}
                                    onClick={() => { toggleCategory(catName); setViewMode("list"); }}
                                    className="p-6 border border-foreground/10 hover:border-primary/50 transition-all rounded-xl shadow-sm hover:shadow-md bg-background cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px] group"
                                >
                                    <span className="font-medium text-sm md:text-base group-hover:text-primary transition-colors">{catName}</span>
                                </div>
                                ))}
                            {!showAllCategories && Object.keys(currentCategoriesDict).length > 11 && (
                                <div onClick={() => setShowAllCategories(true)} className="p-6 border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary hover:bg-primary/5 transition-all rounded-xl shadow-sm cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px]">
                                    <span className="font-bold text-sm md:text-base inline-flex items-center gap-2">View All {Object.keys(currentCategoriesDict).length} Categories <ChevronDown className="w-4 h-4" /></span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-center mt-8 overflow-hidden w-full">
                            <h3 className="text-2xl font-bold tracking-widest uppercase mb-12">{featuredHeading}</h3>
                            {featuredBusinesses.length > 0 ? (
                                <div className="relative flex w-full">
                                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                                    <AutoCarousel speed={50} direction="left" innerClassName="gap-6 px-3 py-2">
                                        {featuredBusinesses.map((fb, i) => (
                                            <Link to={`/listing/${currentTab}/${fb.id}`} target="_blank" rel="noopener noreferrer" key={`${fb.id}-${i}`} className="flex items-center justify-center min-w-[320px] max-w-[320px] p-8 h-32 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group shrink-0">
                                                <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors text-center line-clamp-2">{currentTab === "business" ? fb.businessName : currentTab === "consulting" ? (fb.primaryName || fb.businessName) : currentTab === "events" ? fb.eventName : fb.jobTitle}</span>
                                            </Link>
                                        ))}
                                    </AutoCarousel>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">{noFeaturedText}</div>
                            )}
                        </div>
                    </div>
                ) : isMainCategoryTab && viewMode === "list" ? (
                    <div className="flex flex-col md:flex-row gap-8 pb-24">
                        <div className="w-full md:w-72 shrink-0 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold mb-2 block">Search by country</label>
                                    <Input className="h-10 rounded-xl bg-foreground/5 border-foreground/10" placeholder="" value={searchCountry} onChange={(e) => setSearchCountry(e.target.value)} />
                                </div>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {renderSidebarCategories()}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            {filteredBusinesses.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                                    No companies matched your criteria.
                                </div>
                            ) : (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {paginatedBusinesses.map((item) => {
                                        const title = currentTab === "business" ? item.businessName : currentTab === "consulting" ? (item.primaryName || item.businessName) : currentTab === "events" ? item.eventName : item.jobTitle;
                                        const topLabel = currentTab === "business" ? `BSL : ${item.bsl || "N/A"}` : currentTab === "consulting" ? `Location: ${item.businessAddress || "N/A"}` : currentTab === "events" ? `Date: ${item.startDate || "TBA"}` : `Location: ${item.city || item.location || "Remote"}`;
                                        const bottomLabel = currentTab === "business"
                                            ? (Array.isArray(item.certifications) ? item.certifications.join(", ") : item.certifications || "No specific certs")
                                            : currentTab === "consulting" ? (item.focusArea || "Consultant")
                                                : currentTab === "events" ? `${item.city || "Venue"}, ${item.location || ""}`
                                                    : `${item.businessName || "Company"} • ${item.jobtype || "Role"}`;
                                        const categoryInfo = [
                                            ...(Array.isArray(item.selectedCategories) && item.selectedCategories.length > 0
                                                ? item.selectedCategories
                                                : Array.isArray(item.categories) && item.categories.length > 0
                                                    ? item.categories
                                                    : item.category
                                                        ? [item.category]
                                                        : item.consultingCategory
                                                            ? [item.consultingCategory]
                                                            : item.eventCategory
                                                                ? [item.eventCategory]
                                                                : item.jobCategory
                                                                    ? [item.jobCategory]
                                                                    : []),
                                            ...(Array.isArray(item.selectedSubcategories) ? item.selectedSubcategories : []),
                                            ...(Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories : []),
                                        ];
                                        return (
                                            <Link
                                                key={item.id}
                                                to={`/listing/${currentTab}/${item.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer overflow-hidden flex flex-col h-[320px]"
                                            >
                                                <div className="p-8 flex-1 flex items-center justify-center bg-background border-b border-foreground/10 text-center relative overflow-hidden">
                                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-3">{title}</h3>
                                                </div>
                                                <div className="p-4 bg-muted/40 flex flex-col items-center justify-center h-24">
                                                    <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">{topLabel}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">{bottomLabel}</div>
                                                    {categoryInfo.length > 0 && (
                                                        <div className="text-[10px] text-muted-foreground/80 line-clamp-1 mt-1 text-center">
                                                            {categoryInfo.join(" / ")}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex justify-center items-center gap-2 mt-12 pb-8">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                setCurrentPage(prev => Math.max(prev - 1, 1));
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            disabled={currentPage === 1}
                                            className="rounded-xl"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => {
                                                    // Show first, last, and pages around current
                                                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                                })
                                                .map((page, index, array) => (
                                                    <div key={page} className="flex items-center gap-1">
                                                        {index > 0 && array[index - 1] !== page - 1 && (
                                                            <span className="text-muted-foreground px-1">...</span>
                                                        )}
                                                        <Button
                                                            variant={currentPage === page ? "default" : "outline"}
                                                            onClick={() => {
                                                                setCurrentPage(page);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="w-10 h-10 rounded-xl"
                                                        >
                                                            {page}
                                                        </Button>
                                                    </div>
                                                ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                setCurrentPage(prev => Math.min(prev + 1, totalPages));
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            disabled={currentPage === totalPages}
                                            className="rounded-xl"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
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
                            <Input placeholder="Search for a country..." value={healthAuthSearch} onChange={(e) => setHealthAuthSearch(e.target.value)} className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full" />
                        </div>
                        {filteredHealthAuths.length > 0 ? (
                            <div className="w-full columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                                {filteredHealthAuths.map((auth, index) => (
                                    <a key={index} href={auth.url} target="_blank" rel="noopener noreferrer" className="break-inside-avoid shadow-sm hover:shadow-md border border-foreground/10 hover:border-primary/50 bg-background p-4 rounded-xl flex items-center justify-between group transition-all">
                                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate pr-4">{auth.country}</span>
                                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-2xl min-h-[200px]">
                                <Search className="w-8 h-8 mb-4 text-muted-foreground/50" />
                                <p className="text-lg font-medium text-foreground mb-1">No countries found</p>
                                <p>We couldn't find any health authorities matching "{healthAuthSearch}"</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground bg-foreground/5 border border-foreground/10 rounded-xl">
                        {data.length === 0 ? "No listings found for this category right now. Check back soon." : "We're currently assembling listings for this category."}
                    </div>
                )}
            </div>

            {selectedCategories.length > 0 && (
                <div className="w-full border-t border-foreground/10 bg-muted/10 py-16">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col items-center overflow-hidden w-full">
                            <h3 className="text-2xl font-bold tracking-widest uppercase mb-12">{featuredHeading}</h3>
                            {featuredBusinesses.length > 0 ? (
                                <div className="relative flex w-full">
                                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                                    <AutoCarousel speed={50} direction="left" innerClassName="gap-6 px-3 py-2">
                                        {featuredBusinesses.map((fb, i) => (
                                            <Link to={`/listing/${currentTab}/${fb.id}`} target="_blank" rel="noopener noreferrer" key={`${fb.id}-${i}`} className="flex items-center justify-center min-w-[320px] max-w-[320px] p-8 h-32 bg-background border border-foreground/10 rounded-2xl shadow-sm hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group shrink-0">
                                                <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors text-center line-clamp-2">{currentTab === "business" ? fb.businessName : currentTab === "consulting" ? (fb.primaryName || fb.businessName) : currentTab === "events" ? fb.eventName : fb.jobTitle}</span>
                                            </Link>
                                        ))}
                                    </AutoCarousel>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">{noFeaturedText}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal}>
                    <div className="bg-background border border-foreground/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-foreground/10 bg-foreground/5">
                            <h2 className="text-2xl font-bold">Details</h2>
                            <Button variant="ghost" size="icon" onClick={handleCloseModal}><X className="w-5 h-5" /></Button>
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
                                            <p className="font-semibold capitalize">{selectedProfile.selectedPlan?.replace(/_/g, ' ') || selectedProfile.planId?.replace(/_/g, ' ') || "N/A"}</p>
                                        </div>
                                    </div>
                                    {Array.isArray(selectedProfile.selectedSubcategories) && selectedProfile.selectedSubcategories.length > 0 && (
                                        <div>
                                            <p className="font-bold mb-2 text-sm uppercase text-muted-foreground tracking-wider">Specializations</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProfile.selectedSubcategories.map((s: string, i: number) => (
                                                    <span key={i} className="bg-foreground/10 px-3 py-1 rounded-full text-xs">{s}</span>
                                                ))}
                                                {Array.isArray(selectedProfile.selectedSubSubcategories) && selectedProfile.selectedSubSubcategories.map((s: string, i: number) => (
                                                    <span key={`ss-${i}`} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedProfile.companyProfileText && (
                                        <div>
                                            <p className="font-bold mb-2">{currentTab === 'consulting' ? "Expert Profile" : "Company Overview"}</p>
                                            <p className="text-muted-foreground leading-relaxed">{selectedProfile.companyProfileText}</p>
                                        </div>
                                    )}
                                    {Array.isArray(selectedProfile.serviceCountries) && selectedProfile.serviceCountries.length > 0 && (
                                        <div>
                                            <p className="font-bold mb-2 text-sm uppercase text-muted-foreground tracking-wider">Service Countries</p>
                                            <p className="text-muted-foreground text-sm">{selectedProfile.serviceCountries.join(", ")}</p>
                                        </div>
                                    )}
                                </>
                            )}
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
                                        <div><p className="text-xs uppercase text-muted-foreground mb-1">City</p><p className="font-semibold">{selectedProfile.city}</p></div>
                                        <div><p className="text-xs uppercase text-muted-foreground mb-1">Venue</p><p className="font-semibold">{selectedProfile.location}</p></div>
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
