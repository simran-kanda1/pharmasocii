import fs from 'fs';
import path from 'path';

function removeTagsContaining(filePath, searchStrings) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // We will find lines that contain the search strings and remove them if they are wrapped in <p> or <CardDescription>
    // Since some might span multiple lines or have ternary operators inside <CardDescription>, it's safer to use regex to strip the tags entirely, or just replace the text if it's complex.

    for (const str of searchStrings) {
        // Remove <p className="...">...string...</p>
        const pRegex = new RegExp(`\\s*<p[^>]*>.*?${str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}.*?<\\/p>`, 'g');
        content = content.replace(pRegex, '');
        
        // Remove <CardDescription>...string...</CardDescription>
        const cdRegex = new RegExp(`\\s*<CardDescription>.*?${str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}.*?<\\/CardDescription>`, 'gs');
        content = content.replace(cdRegex, '');
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
}

const files = [
    'src/pages/CompleteProfile.tsx',
    'src/pages/partner/AddListing.tsx',
    'src/pages/partner/Dashboard.tsx'
];

const targets = [
    "Choose from existing representatives",
    "Optional: Add a new representative or choose one from existing contacts.",
    "Please fill out the remainder of your partner business information.",
    "Primary and alternate contact details for your account"
];

for (const file of files) {
    removeTagsContaining(file, targets);
}

// For "Select your service regions, countries and categories", it is inside a complex ternary operator inside CardDescription.
// If the user wants to remove the CardDescription for Service details / Business details entirely, we can just remove the whole <CardDescription> block under the CardTitle for details.
function removeDetailsCardDescription(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Replace the block of CardDescription that contains "Select your service regions"
    // It looks like:
    // <CardDescription>
    //     {formData.group === "business_offerings" ? "..." :
    //      ...}
    // </CardDescription>
    
    content = content.replace(/\s*<CardDescription>\s*\{.*?(?:formData\.group|dbGroup).*?\}.*?<\/CardDescription>/gs, '');

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Removed CardDescription in ${filePath}`);
}

for (const file of files) {
    removeDetailsCardDescription(file);
}

