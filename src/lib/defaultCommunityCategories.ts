import type { CommunityCategoryDoc } from "./communityTypes";

/** Seed tree used when `config/communityCategories` is missing. */
export const DEFAULT_COMMUNITY_CATEGORIES: CommunityCategoryDoc = {
  mains: [
    {
      id: "manufacturing",
      label: "Manufacturing",
      subs: [
        {
          id: "drug_substance",
          label: "Drug Substance Manufacturing",
          subSubs: [
            { id: "gene_therapy", label: "Gene therapy" },
            { id: "cell_therapy", label: "Cell therapy" },
          ],
        },
        {
          id: "drug_product",
          label: "Drug Product Manufacturing",
          subSubs: [
            { id: "sterile", label: "Sterile products" },
            { id: "oral", label: "Oral solid dose" },
          ],
        },
      ],
    },
    {
      id: "facility_design",
      label: "Facility Design & Qualifications",
      subs: [
        {
          id: "lab",
          label: "Laboratory",
          subSubs: [],
        },
        {
          id: "warehouse",
          label: "Warehouse",
          subSubs: [],
        },
      ],
    },
    {
      id: "regulatory",
      label: "Regulatory & Quality",
      subs: [
        { id: "gmp", label: "GMP compliance", subSubs: [] },
        { id: "validation", label: "Validation", subSubs: [] },
      ],
    },
  ],
};
