import fs from 'fs';
import path from 'path';

function updateFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    const injection = `
            const isAnySubSelected = hasSubs && subs.some((entry) => {
                const subLabel = getSubLabel(entry);
                const isNested = isBusinessGroup && hasSubSub(entry);
                const compositeSubKey = \`\${cat} > \${subLabel}\`;
                if (selectedSubcategories.includes(compositeSubKey) || selectedSubcategories.includes(subLabel)) return true;
                if (isNested && entry.subSubcategories) {
                    return entry.subSubcategories.some((ss) => {
                        const compositeSsKey = \`\${cat} > \${subLabel} > \${ss}\`;
                        return selectedSubSubcategories.includes(compositeSsKey) || selectedSubSubcategories.includes(ss);
                    });
                }
                return false;
            });`;

    // Inject isAnySubSelected definition
    content = content.replace(
        /const isParentSelected = selectedCategories\.includes\(cat\);/,
        `const isParentSelected = selectedCategories.includes(cat);\n${injection}`
    );

    // Update checked and className
    content = content.replace(
        /checked=\{hasSubs \? isExpanded : isParentSelected\}/g,
        'checked={hasSubs ? isAnySubSelected : isParentSelected}'
    );
    content = content.replace(
        /className=\{hasSubs && isExpanded \? "border-red-500 data-\[state=checked\]:bg-red-500 data-\[state=checked\]:border-red-500" : ""\}/g,
        'className={hasSubs && isAnySubSelected ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}'
    );

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
}

updateFile('src/pages/CompleteProfile.tsx');
updateFile('src/pages/partner/AddListing.tsx');
