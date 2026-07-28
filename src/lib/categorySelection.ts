export type CategoryEntry = string | { label: string; subSubcategories: string[] };
export type CategoryDict = Record<string, CategoryEntry[]>;

const normalize = (value: string) => value.trim().toLowerCase();

const uniqueByNormalized = (values: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const normalized = normalize(value);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(value);
    });
    return result;
};

export function buildDisplayCategoryFields(
    categoryDict: CategoryDict | null,
    selectedCategories: string[],
    selectedSubcategories: string[],
    selectedSubSubcategories: string[]
) {
    const categoriesDisplay: string[] = [];
    const subcategoriesDisplay: string[] = [];

    const unprocessedCategories: string[] = [];
    const unprocessedSubcategories: string[] = [];
    const unprocessedSubSubcategories: string[] = [];

    selectedCategories.forEach(cat => {
        if (cat.includes(" > ")) {
            const parts = cat.split(" > ");
            categoriesDisplay.push(parts[parts.length - 1]);
        } else {
            unprocessedCategories.push(cat);
        }
    });

    selectedSubcategories.forEach(sub => {
        if (sub.includes(" > ")) {
            const parts = sub.split(" > ");
            if (parts.length >= 2) {
                categoriesDisplay.push(parts[0]);
                subcategoriesDisplay.push(parts[1]);
            } else {
                subcategoriesDisplay.push(parts[0]);
            }
        } else {
            unprocessedSubcategories.push(sub);
        }
    });

    selectedSubSubcategories.forEach(subSub => {
        if (subSub.includes(" > ")) {
            const parts = subSub.split(" > ");
            if (parts.length >= 3) {
                categoriesDisplay.push(parts[0]);
                subcategoriesDisplay.push(parts[1]);
            } else if (parts.length === 2) {
                subcategoriesDisplay.push(parts[0]);
            }
        } else {
            unprocessedSubSubcategories.push(subSub);
        }
    });

    if (categoryDict) {
        const subToCategory = new Map<string, string>();
        const subSubToSubAndCategory = new Map<string, { subcategory: string; category: string }>();

        Object.entries(categoryDict).forEach(([categoryLabel, entries]) => {
            (entries || []).forEach((entry) => {
                const subcategoryLabel = typeof entry === "string" ? entry : entry.label;
                subToCategory.set(normalize(subcategoryLabel), categoryLabel);

                if (typeof entry !== "string" && Array.isArray(entry.subSubcategories)) {
                    entry.subSubcategories.forEach((subSubLabel) => {
                        subSubToSubAndCategory.set(normalize(subSubLabel), {
                            subcategory: subcategoryLabel,
                            category: categoryLabel,
                        });
                    });
                }
            });
        });

        unprocessedCategories.forEach(cat => {
            categoriesDisplay.push(cat);
        });

        unprocessedSubcategories.forEach((subcategory) => {
            subcategoriesDisplay.push(subcategory);
            const parentCategory = subToCategory.get(normalize(subcategory));
            if (parentCategory) categoriesDisplay.push(parentCategory);
        });

        unprocessedSubSubcategories.forEach((subSubcategory) => {
            const relation = subSubToSubAndCategory.get(normalize(subSubcategory));
            if (relation) {
                subcategoriesDisplay.push(relation.subcategory);
                categoriesDisplay.push(relation.category);
            }
        });
    } else {
        unprocessedCategories.forEach(cat => categoriesDisplay.push(cat));
        unprocessedSubcategories.forEach(sub => subcategoriesDisplay.push(sub));
    }

    return {
        selectedCategoriesDisplay: uniqueByNormalized(categoriesDisplay),
        selectedSubcategoriesDisplay: uniqueByNormalized(subcategoriesDisplay),
    };
}

export function sanitizeLowestLevelSelections(
    categoryDict: CategoryDict | null,
    selectedCategories: string[],
    selectedSubcategories: string[],
    selectedSubSubcategories: string[]
) {
    if (!categoryDict) {
        return {
            selectedCategories: uniqueByNormalized(selectedCategories),
            selectedSubcategories: uniqueByNormalized(selectedSubcategories),
            selectedSubSubcategories: uniqueByNormalized(selectedSubSubcategories),
        };
    }

    const nonLeafCategoryTokens = new Set<string>();
    const nonLeafSubcategoryTokens = new Set<string>();

    Object.entries(categoryDict).forEach(([categoryLabel, entries]) => {
        if (Array.isArray(entries) && entries.length > 0) {
            nonLeafCategoryTokens.add(normalize(categoryLabel));
        }
        (entries || []).forEach((entry) => {
            if (typeof entry !== "string" && Array.isArray(entry.subSubcategories) && entry.subSubcategories.length > 0) {
                nonLeafSubcategoryTokens.add(normalize(entry.label));
            }
        });
    });

    const getLeafName = (key: string) => key.split(" > ").pop()?.trim() || "";

    const finalCategories = selectedCategories.filter((cat) => {
        const catLeaf = getLeafName(cat);
        const normCatLeaf = normalize(catLeaf);

        if (!nonLeafCategoryTokens.has(normCatLeaf)) {
            return true;
        }

        const hasSelectedChildren = 
            selectedSubcategories.some(sub => {
                if (sub.includes(" > ")) {
                    const parts = sub.split(" > ");
                    return normalize(parts[0]) === normCatLeaf;
                }
                return false;
            }) ||
            selectedSubSubcategories.some(ss => {
                if (ss.includes(" > ")) {
                    const parts = ss.split(" > ");
                    return normalize(parts[0]) === normCatLeaf;
                }
                return false;
            });

        if (hasSelectedChildren) return false;

        return !selectedSubcategories.some(sub => {
            if (!sub.includes(" > ")) {
                const entries = categoryDict[catLeaf] || [];
                return entries.some(entry => normalize(getSubLabel(entry)) === normalize(sub));
            }
            return false;
        });
    });

    const finalSubcategories = selectedSubcategories.filter((sub) => {
        const subParts = sub.includes(" > ") ? sub.split(" > ") : [sub];
        const subLeaf = subParts[subParts.length - 1];
        const normSubLeaf = normalize(subLeaf);

        if (!nonLeafSubcategoryTokens.has(normSubLeaf)) {
            return true;
        }

        const hasSelectedSubSub = selectedSubSubcategories.some(ss => {
            if (ss.includes(" > ")) {
                const ssParts = ss.split(" > ");
                if (sub.includes(" > ")) {
                    return normalize(ssParts[0]) === normalize(subParts[0]) && normalize(ssParts[1]) === normSubLeaf;
                }
                return normalize(ssParts[1]) === normSubLeaf;
            }
            return false;
        });

        if (hasSelectedSubSub) return false;

        return !selectedSubSubcategories.some(ss => {
            if (!ss.includes(" > ")) {
                let foundRelation = false;
                Object.values(categoryDict).forEach(entries => {
                    entries.forEach(entry => {
                        if (typeof entry !== "string" && normalize(entry.label) === normSubLeaf) {
                            if (entry.subSubcategories.some(item => normalize(item) === normalize(ss))) {
                                foundRelation = true;
                            }
                        }
                    });
                });
                return foundRelation;
            }
            return false;
        });
    });

    return {
        selectedCategories: uniqueByNormalized(finalCategories),
        selectedSubcategories: uniqueByNormalized(finalSubcategories),
        selectedSubSubcategories: uniqueByNormalized(selectedSubSubcategories),
    };
}

const getSubLabel = (entry: CategoryEntry): string =>
    typeof entry === "string" ? entry : entry.label;

export function matchCategoryOrSub(itemKey: string, filterKey: string): boolean {
    const normItem = itemKey.trim().toLowerCase();
    const normFilter = filterKey.trim().toLowerCase();
    if (normItem === normFilter) return true;
    
    const itemIsComposite = normItem.includes(">");
    const filterIsComposite = normFilter.includes(">");
    
    if (itemIsComposite && filterIsComposite) {
        return normItem === normFilter;
    }
    if (itemIsComposite && !filterIsComposite) {
        const itemLeaf = normItem.split(">").pop()?.trim() || "";
        return itemLeaf === normFilter;
    }
    if (!itemIsComposite && filterIsComposite) {
        const filterLeaf = normFilter.split(">").pop()?.trim() || "";
        return normItem === filterLeaf;
    }
    return normItem === normFilter;
}

