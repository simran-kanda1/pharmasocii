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
    if (!categoryDict) {
        return {
            selectedCategoriesDisplay: uniqueByNormalized(selectedCategories),
            selectedSubcategoriesDisplay: uniqueByNormalized(selectedSubcategories),
        };
    }

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

    const categoriesDisplay = [...selectedCategories];
    const subcategoriesDisplay = [...selectedSubcategories];

    selectedSubcategories.forEach((subcategory) => {
        const parentCategory = subToCategory.get(normalize(subcategory));
        if (parentCategory) categoriesDisplay.push(parentCategory);
    });

    selectedSubSubcategories.forEach((subSubcategory) => {
        const relation = subSubToSubAndCategory.get(normalize(subSubcategory));
        if (!relation) return;
        subcategoriesDisplay.push(relation.subcategory);
        categoriesDisplay.push(relation.category);
    });

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

    return {
        selectedCategories: uniqueByNormalized(
            selectedCategories.filter((category) => !nonLeafCategoryTokens.has(normalize(category)))
        ),
        selectedSubcategories: uniqueByNormalized(
            selectedSubcategories.filter((subcategory) => !nonLeafSubcategoryTokens.has(normalize(subcategory)))
        ),
        selectedSubSubcategories: uniqueByNormalized(selectedSubSubcategories),
    };
}
