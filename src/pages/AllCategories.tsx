import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Building2, Users, Search, ExternalLink, Calendar, Briefcase, X, ChevronRight, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/firebase";
import { collection, collectionGroup, query, where, getDocs } from "firebase/firestore";

//Types 
type SubcategoryEntry = string | { label: string; subSubcategories: string[] };
type CategoriesDict = Record<string, SubcategoryEntry[]>;

const getSubLabel = (entry: SubcategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

const hasSubSub = (entry: SubcategoryEntry): entry is { label: string; subSubcategories: string[] } =>
    typeof entry !== "string";

const BUSINESS_CATEGORIES: CategoriesDict = {
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

const CONSULTING_CATEGORIES: Record<string, string[]> = {
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

const EVENTS_CATEGORIES: Record<string, string[]> = {
    "AAPS (American Association Of Pharmaceutical Scientists)": [], "Advanced & Next Generation Therapies": [], "Analytical Development & Testing": [], "Analytical Methods": [], "Antibodies & Antibody Conjugates": [], "Artificial Intelligence, Bioinformatics & Technology": [], "Aseptic Technologies": [], "Bioassays": [], "Biomarkers & Diagnostics": [], "Biomaterials & Biodevices": [], "Biosimilars": [], "Biotechnology": [], "Bispecifics": [], "Building Systems & Controls": [], "CASSS": [], "Cell & Gene Therapy": [], "Chemistry Manufacturing & Controls (CMC)": [], "Clinical Research & Development": [], "Clinical Trials & Research": [], "Comparability": [], "Continuous Manufacturing/PAT/Real Time Quality": [], "Dermatology": [], "DIA (Drug Information Association)": [], "Diabetes & Cardiovascular Diseases": [], "Digital Innovation In Health Care": [], "Drug Discovery & Development": [], "Drug Safety": [], "Epidemiology": [], "Formulation & Drug Delivery": [], "Gastroenterology": [], "Gene Editing": [], "Genomics": [], "GMP Facilities": [], "Good Manufacturing Practices (GMPs)": [], "Health Care Conference": [], "Health Policy": [], "Health Technology Assessment": [], "Hematology": [], "Hepatology": [], "Higher Order Structure": [], "ICH Conferences": [], "Infectious Diseases": [], "Intellectual Property": [], "ISPE (International Society For Pharmaceutical Engineering)": [], "Labelling": [], "Laboratory Equipment": [], "Manufacturing & Technical Operations": [], "Manufacturing Equipment": [], "Market Access": [], "Marketing & Sales": [], "Mass Spectrometry": [], "Materials, Reagents & Excipients": [], "Medical Affairs": [],
    "Medical Devices": ["Abilation Therapy", "Bispecifics", "Cardiovascular", "Central Nervous System", "Companion Diagnostics", "Consumer Health", "Critical Care", "Dermatology", "Diagnostics", "Gene Editing", "Imaging", "Implanatable", "In Vitro Diagnostics", "Infectious Diseases", "Medical Equipment", "Men's Health", "Metabolic & Endocrine", "Nucleic Acid Based Therapies", "Ophthalmology", "Respiratory", "RNA Based Therapies", "Single Use", "Software for Devices", "Surgical Devices", "Women's Health"],
    "Medical Equipment": [], "Medicinal & Pharmaceutical Chemistry": [], "Men's Health": [], "Metabolic & Endocrine": [], "Microbiology, Virology, Immunology & Infectious Diseases": [], "Molecular & Precision Medicine": [], "Nephrology": [], "Neurology & Psychiatry": [], "Nucleic Acid Based Therapies": [], "Oncology": [], "Other": [], "Patient Recruitment & Engagement": [], "Pediatrics": [], "Pharmaceutical Law": [], "Pharmaceutical Science": [], "Pharmaceuticals": [], "Pharmacology & Toxicology": [], "Potency Assays": [], "Pre-Clinical Research & Development": [], "Pricing & Health Technology": [], "Quality & Compliance": [], "Radiopharmaceuticals": [], "Rare Disease & Orphan Drug Products": [], "Regulations & Guidances": [], "Regulatory Affairs": [], "Research & Innovation": [], "Respiratory": [], "Rheumatology": [], "Risk Management & Pharmacovigilance": [], "RNA Based Therapies": [], "Stability": [], "Stem Cell & Regenerative Medicine": [], "Sterile Drug Products": [], "Supply Chain & Logistics": [], "Tools And Technology": [], "Translational Sciences": [], "Urology": ["<= -60C"], "Vaccines, Immunology & Antibiotics": [], "Validation": [], "Viral Vectors": [], "Well Characterized Biologics (WCBP)": [], "Women's Health": []
};

const JOBS_CATEGORIES: Record<string, string[]> = {
    "Administration": [], "Analytical Sciences": [], "Artificial Intelligence & Bioinformatics": [], "Business Development": [], "Clinical Operations": [], "Clinical Research & Development": [], "Drug Discovery": [], "Engineering": [], "Facilities & Building Systems": [], "Finance": [], "Formulation & Development": [], "Health Technology & Market Access": [], "Human Resources & People Management": [], "Information Technology": [], "Legal": [], "Manufacturing & Technical Operations": [], "Manufacturing Sciences & Technology": [], "Market Access": [], "Marketing": [], "Other": [], "Pharmacology": [], "Pre Clinical Research & Development": [], "Product Development": [], "Project Or Program Management": [], "Quality & Compliance": [], "Quality Control": [], "Regulatory": [], "Sales": [], "Toxicology": [], "Translational Sciences": [], "Validation": []
};

const HEALTH_AUTHORITIES = [
    { country: "Afghanistan", url: "https://www.afda.gov.af/en/guidelines" }, { country: "Africa", url: "https://amrh.nepad.org/amrh-countries" }, { country: "Albania", url: "https://shendetesia.gov.al/" },
    { country: "Algeria", url: "https://ghdx.healthdata.org/organizations/ministry-health-population-and-hospital-reform-algeria" }, { country: "Andorra", url: "https://ghdx.healthdata.org/organizations/ministry-health-and-welfare-andorra" }, { country: "Angola", url: "https://www.trade.gov/country-commercial-guides/angola-healthcare#:~:text=ARMED's%20main%20objectives%20are%20to,WHO%20norms%20and%20Angolan%20regulations." },
    { country: "Antigua and Barbuda", url: "https://health.gov.ag/" }, { country: "Argentina", url: "https://www.argentina.gob.ar/anmat/anmat-en/what-anmat" }, { country: "Armenia", url: "http://www.pharm.am/index.php/en/" },
    { country: "Australia", url: "#" }, { country: "Austria", url: "#" }, { country: "Azerbaijan", url: "#" }, { country: "Bahrain", url: "#" }, { country: "Bangladesh", url: "#" }, { country: "Barbados", url: "#" }, { country: "Belarus", url: "#" }, { country: "Belgium", url: "#" }, { country: "Belize", url: "#" }, { country: "Benin", url: "#" }, { country: "Bhutan", url: "#" }, { country: "Bolivia", url: "#" }, { country: "Bosnia", url: "#" }, { country: "Botswana", url: "#" }, { country: "Brazil", url: "#" }, { country: "Brunei", url: "#" }, { country: "Bulgaria", url: "#" }, { country: "Burkina Faso", url: "#" }, { country: "Burundi", url: "#" }, { country: "Cabo Verde", url: "#" }, { country: "Cambodia", url: "#" }, { country: "Cameroon", url: "#" }, { country: "Canada", url: "https://www.canada.ca/en/health-canada/corporate/about-health-canada/branches-agencies/health-products-food-branch.html" }, { country: "Central African Republic", url: "#" }, { country: "Chad", url: "#" }, { country: "Chile", url: "#" }, { country: "China", url: "#" }, { country: "Colombia", url: "#" }, { country: "Comoros", url: "#" }, { country: "Congo", url: "#" }, { country: "Costa Rica", url: "#" }, { country: "Côte d'Ivoire", url: "#" }, { country: "Croatia", url: "#" }, { country: "Cuba", url: "#" }, { country: "Cyprus", url: "#" }, { country: "Czech Republic", url: "#" }, { country: "Denmark", url: "#" }, { country: "Djibouti", url: "#" }, { country: "Dominica", url: "#" }, { country: "Dominican Republic", url: "#" }, { country: "Dubai", url: "#" }, { country: "East Timor", url: "#" }, { country: "Ecuador", url: "#" }, { country: "Egypt", url: "#" }, { country: "El Salvador", url: "#" }, { country: "Eritrea", url: "#" }, { country: "Estonia", url: "#" }, { country: "Eswatini", url: "#" }, { country: "Ethiopia", url: "#" }, { country: "Europe (European Commission)", url: "#" }, { country: "Europe (European Medicines Agency)", url: "#" }, { country: "Fiji", url: "#" }, { country: "Finland", url: "#" }, { country: "France", url: "#" }, { country: "Gabon", url: "#" }, { country: "Gambia", url: "#" }, { country: "Georgia", url: "#" }, { country: "Germany (Drugs & Medical Devices)", url: "#" }, { country: "Germany (Vaccines & Biomedicines)", url: "#" }, { country: "Ghana", url: "#" }, { country: "Greece", url: "#" }, { country: "Grenada", url: "#" }, { country: "Guatemala", url: "#" }, { country: "Guyana", url: "#" }, { country: "Haiti", url: "#" }, { country: "Honduras", url: "#" }, { country: "Hong Kong", url: "#" }, { country: "Hungary", url: "#" }, { country: "Iceland", url: "#" }, { country: "India", url: "#" }, { country: "Indonesia", url: "#" }, { country: "Iran", url: "#" }, { country: "Iraq", url: "#" }, { country: "Ireland", url: "#" }, { country: "Israel", url: "#" }, { country: "Italy", url: "#" }, { country: "Jamaica", url: "#" }, { country: "Japan", url: "#" }, { country: "Jordon", url: "#" }, { country: "Kazakhstan", url: "#" }, { country: "Kenya", url: "#" }, { country: "Kiribati", url: "#" }, { country: "Korea", url: "#" }, { country: "Kosovo", url: "#" }, { country: "Kuwait", url: "#" }, { country: "Kyrgyzstan", url: "#" }, { country: "Laos", url: "#" }, { country: "Latvia", url: "#" }, { country: "Lebanon", url: "#" }, { country: "Liberia", url: "#" }, { country: "Libya", url: "#" }, { country: "Liechtenstein", url: "#" }, { country: "Lithuania", url: "#" }, { country: "Luxembourg", url: "#" }, { country: "Madagascar", url: "#" }, { country: "Malawi", url: "#" }, { country: "Malaysia", url: "#" }, { country: "Maldives", url: "#" }, { country: "Mali", url: "#" }, { country: "Malta", url: "#" }, { country: "Marshall Islands", url: "#" }, { country: "Mauritius", url: "#" }, { country: "Mexico", url: "#" }, { country: "Micronesia", url: "#" }, { country: "Moldova", url: "#" }, { country: "Monaco", url: "#" }, { country: "Mongolia", url: "#" }, { country: "Montenegro", url: "#" }, { country: "Morocco", url: "#" }, { country: "Mozambique", url: "#" }, { country: "Myanmar (Burma)", url: "#" }, { country: "Namibia", url: "#" }, { country: "Nauru", url: "#" }, { country: "Nepal", url: "#" }, { country: "Netherlands", url: "#" }, { country: "New Zealand", url: "#" }, { country: "Nicaragua", url: "#" }, { country: "Niger", url: "#" }, { country: "Nigeria", url: "#" }, { country: "North Macedonia", url: "#" }, { country: "Norway", url: "#" }, { country: "Oman", url: "#" }, { country: "Pakistan", url: "#" }, { country: "Palau", url: "#" }, { country: "Palestine", url: "#" }, { country: "Panama", url: "#" }, { country: "Papua New Guinea", url: "#" }, { country: "Paraguay", url: "#" }, { country: "Peru", url: "#" }, { country: "Philippines", url: "#" }, { country: "Poland", url: "#" }, { country: "Portugal", url: "#" }, { country: "Qatar", url: "#" }, { country: "Rawanda", url: "#" }, { country: "Romania", url: "#" }, { country: "Russia", url: "#" }, { country: "Saint Kitts and Nevis", url: "#" }, { country: "Saint Vincent and Grenadines", url: "#" }, { country: "Samoa", url: "#" }, { country: "San Marino, Ministry of Health", url: "#" }, { country: "Sao Tome and Principe", url: "#" }, { country: "Saudi Arabia", url: "#" }, { country: "Senegal", url: "#" }, { country: "Serbia", url: "#" }, { country: "Sierra Leone", url: "#" }, { country: "Singapore", url: "#" }, { country: "Slovak Republic", url: "#" }, { country: "Slovenia", url: "#" }, { country: "Solomon Islands", url: "#" }, { country: "Somalia", url: "#" }, { country: "South Africa", url: "#" }, { country: "Spain", url: "#" }, { country: "Spanish", url: "#" }, { country: "Sri Lanka", url: "#" }, { country: "St. Lucia", url: "#" }, { country: "Sudan", url: "#" }, { country: "Suriname", url: "#" }, { country: "Swaziland", url: "#" }, { country: "Sweden", url: "#" }, { country: "Switzerland", url: "#" }, { country: "Syria", url: "#" }, { country: "Taiwan", url: "#" }, { country: "Tanzania", url: "#" }, { country: "Thailand", url: "#" }, { country: "Therapeutic", url: "#" }, { country: "Togo", url: "#" }, { country: "Tonga", url: "#" }, { country: "Trinidad and Tobago", url: "#" }, { country: "Tunisia", url: "#" }, { country: "Turkey", url: "#" }, { country: "Turkmenistan", url: "#" }, { country: "Tuvalu", url: "#" }, { country: "UAE", url: "#" }, { country: "Uganda", url: "#" }, { country: "UK", url: "#" }, { country: "Ukraine", url: "#" }, { country: "Uruguay", url: "#" }, { country: "Uzbekistan", url: "#" }, { country: "Vanuatu", url: "#" }, { country: "Venezuela", url: "#" }, { country: "Yemen", url: "#" }, { country: "Zambia", url: "#" }, { country: "Zimbabwe", url: "#" }
];

export default function AllCategories() {
    const { category } = useParams<{ category: string }>();
    const currentTab = category || "business";

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);

    // ── All three levels are now arrays (multi-select) ──
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [selectedSubSubcategories, setSelectedSubSubcategories] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
    const [searchCountry, setSearchCountry] = useState("");
    const [healthAuthSearch, setHealthAuthSearch] = useState("");
    const [showAllCategories, setShowAllCategories] = useState(false);

    useEffect(() => {
        const fetchAllCategoriesData = async () => {
            setLoading(true);
            try {
                let snap: any = null;
                if (currentTab === "business") {
                    const q = query(collectionGroup(db, "businessOfferingsCollection"), where("active", "==", true));
                    snap = await getDocs(q);
                } else if (currentTab === "consulting") {
                    const q = query(collection(db, "consultingCollection"), where("active", "==", true));
                    snap = await getDocs(q);
                } else if (currentTab === "events") {
                    const q = query(collection(db, "eventsCollection"), where("active", "==", true));
                    snap = await getDocs(q);
                } else if (currentTab === "jobs") {
                    const q = query(collection(db, "jobsCollection"), where("active", "==", true));
                    snap = await getDocs(q);
                }
                if (snap) {
                    setData(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Record<string, any>) })));
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
    };

    const toggleSubcategory = (sub: string) => {
        setSelectedSubcategories(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
    };

    const toggleSubSubcategory = (subSub: string) => {
        setSelectedSubSubcategories(prev =>
            prev.includes(subSub) ? prev.filter(s => s !== subSub) : [...prev, subSub]
        );
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
        if (!isMainCategoryTab) return true;

        // Resolve which category field this item uses
        const itemCategory: string =
            item.category ||
            item.selectedGroup?.replace(/_/g, " ") ||
            item.consultingCategory ||
            item.eventCategory ||
            item.jobCategory ||
            "";

        // Category: item must match AT LEAST ONE selected category (OR logic across categories)
        if (selectedCategories.length > 0 && !selectedCategories.includes(itemCategory)) {
            return false;
        }

        // Subcategory: item must contain ALL selected subs (AND logic)
        if (selectedSubcategories.length > 0) {
            const itemSubs: string[] = Array.isArray(item.selectedSubcategories) ? item.selectedSubcategories : [];
            if (!selectedSubcategories.every(sel => itemSubs.includes(sel))) return false;
        }

        // Sub-subcategory: item must contain ALL selected sub-subs (AND logic)
        if (selectedSubSubcategories.length > 0) {
            const itemSubSubs: string[] = Array.isArray(item.selectedSubSubcategories) ? item.selectedSubSubcategories : [];
            if (!selectedSubSubcategories.every(sel => itemSubSubs.includes(sel))) return false;
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

    const featuredBusinesses = data.filter(item => item.isFeatured === true);

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
                    <h1 className="text-4xl font-bold tracking-tight mb-4">All Categories</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                        Explore, connect, and collaborate with leading businesses, experts, and talent across the global biotech ecosystem.
                    </p>
                </div>
            </div>

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
                        <button onClick={resetCategorySelection} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                            Clear all
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-24 text-muted-foreground">Loading {currentTab}...</div>
                ) : isMainCategoryTab && selectedCategories.length === 0 ? (
                    <div className="flex flex-col gap-16 pb-24 w-full max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(showAllCategories ? Object.keys(currentCategoriesDict) : Object.keys(currentCategoriesDict).slice(0, 11)).map((catName) => (
                                <div
                                    key={catName}
                                    onClick={() => toggleCategory(catName)}
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

                        <div className="flex flex-col items-center mt-8">
                            <h3 className="text-2xl font-bold tracking-widest uppercase mb-12">{featuredHeading}</h3>
                            {featuredBusinesses.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                    {featuredBusinesses.map(fb => (
                                        <div key={fb.id} onClick={() => setSelectedProfile(fb)} className="p-6 border border-foreground/10 hover:border-primary/50 transition-colors rounded-xl shadow-sm hover:shadow-md bg-background cursor-pointer flex flex-col justify-center items-center text-center min-h-[120px]">
                                            <span className="font-medium text-lg">{currentTab === "business" ? fb.businessName : currentTab === "consulting" ? (fb.primaryName || fb.businessName) : currentTab === "events" ? fb.eventName : fb.jobTitle}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground">{noFeaturedText}</div>
                            )}
                        </div>
                    </div>
                ) : isMainCategoryTab && selectedCategories.length > 0 ? (
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredBusinesses.map((item) => {
                                        const title = currentTab === "business" ? item.businessName : currentTab === "consulting" ? (item.primaryName || item.businessName) : currentTab === "events" ? item.eventName : item.jobTitle;
                                        const topLabel = currentTab === "business" ? `BSL : ${item.bsl || "N/A"}` : currentTab === "consulting" ? `Location: ${item.businessAddress || "N/A"}` : currentTab === "events" ? `Date: ${item.startDate || "TBA"}` : `Location: ${item.city || item.location || "Remote"}`;
                                        const bottomLabel = currentTab === "business"
                                            ? (Array.isArray(item.certifications) ? item.certifications.join(", ") : item.certifications || "No specific certs")
                                            : currentTab === "consulting" ? (item.focusArea || "Consultant")
                                                : currentTab === "events" ? `${item.city || "Venue"}, ${item.location || ""}`
                                                    : `${item.businessName || "Company"} • ${item.jobtype || "Role"}`;
                                        return (
                                            <div key={item.id} onClick={() => setSelectedProfile(item)} className="group rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer overflow-hidden flex flex-col h-[320px]">
                                                <div className="p-8 flex-1 flex items-center justify-center bg-background border-b border-foreground/10 text-center relative overflow-hidden">
                                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-3">{title}</h3>
                                                </div>
                                                <div className="p-4 bg-muted/40 flex flex-col items-center justify-center h-24">
                                                    <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">{topLabel}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">{bottomLabel}</div>
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
                            <Input placeholder="Search for a country..." value={healthAuthSearch} onChange={(e) => setHealthAuthSearch(e.target.value)} className="pl-12 py-6 text-lg rounded-2xl border-foreground/10 bg-background shadow-sm w-full" />
                        </div>
                        <div className="w-full columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                            {filteredHealthAuths.length > 0 ? (
                                filteredHealthAuths.map((auth, index) => (
                                    <a key={index} href={auth.url} target="_blank" rel="noopener noreferrer" className="break-inside-avoid shadow-sm hover:shadow-md border border-foreground/10 hover:border-primary/50 bg-background p-4 rounded-xl flex items-center justify-between group transition-all">
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
                                            <p className="font-bold mb-2 text-sm uppercase text-muted-foreground tracking-wider">Specialisations</p>
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
