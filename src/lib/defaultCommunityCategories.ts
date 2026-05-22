import type { CommunityCategoryDoc, CommunityMain } from "./communityTypes";
import { slugifyCategoryId } from "./communityCategoryEditorUtils";

/** All main categories from community UI screenshots (subs added via admin later). */
const MAIN_CATEGORY_LABELS = [
  "Analytical Comparability",
  "Artificial Intelligence & Bioinformatics",
  "Auditing",
  "Automation",
  "Bioethics",
  "Biological Resource Banks",
  "Biostatistics & Data Science",
  "Building Systems & Controls",
  "Capacity Planning",
  "Clinical & Diagnostics Testing",
  "Clinical Trials & Research",
  "Commercialization",
  "Container Closure & Packaging",
  "Control Strategy",
  "Delivery Devices & Systems",
  "Digital Solutions For Life Sciences",
  "Drug Discovery & Development",
  "Drug Safety",
  "Engineering",
  "Environmental Impact Assessments",
  "Environmental Monitoring & Testing",
  "Equipment & Related Activities",
  "Facility Design & Qualifications",
  "Formulation Development",
  "Genomics",
  "Global Sample Management & Logistics",
  "Guidelines & Acts",
  "Import & Export",
  "In Country Agent",
  "Insilco Assessments",
  "Intellectual Property & Patents",
  "Laboratory & Related Activities",
  "Manufacturing",
  "Material Sciences",
  "Material/Components Qualification",
  "Materials, Excipients, Cells",
  "Medical Affairs",
  "Medical Devices & Delivery Systems",
  "Packaging & Labeling",
  "Pest Control (GMP Facility)",
  "Pharmacology & Toxicology",
  "Post Market Surveillance",
  "Process Characterization Studies",
  "Process Development & Technology Transfer",
  "Quality & Compliance",
  "Radiopharmaceuticals",
  "Regulatory Sciences",
  "Risk Assessments",
  "Stability Studies & Strategy",
  "Statistical Analysis",
  "Storage, Distribution, Shipping",
  "Technical Writing",
  "Therapeutic Areas",
  "Translators/Translations",
  "Validation",
  "Viral Safety & Clearance Studies",
  "Warehouse Controls",
  "Water",
] as const;

function buildMainCategories(): CommunityMain[] {
  const usedIds = new Set<string>();
  return MAIN_CATEGORY_LABELS.map((label) => {
    let id = slugifyCategoryId(label);
    let n = 1;
    while (usedIds.has(id)) {
      id = `${slugifyCategoryId(label)}_${n++}`;
    }
    usedIds.add(id);
    return { id, label, subs: [] };
  });
}

/** Seed tree used when `config/communityCategories` is missing. */
export const DEFAULT_COMMUNITY_CATEGORIES: CommunityCategoryDoc = {
  mains: buildMainCategories(),
};
