const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

walk('./src', (filePath) => {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // We want to replace 'uppercase' when it's inside className attributes or strings representing classes.
    // A simple regex: replace ' uppercase ' with ' ', 'uppercase ' with '', ' uppercase' with ''
    // Actually, just replace `\buppercase\b` with empty string ONLY if it's inside a quote or template literal?
    // Since 'uppercase' as a variable or property (e.g. passwordChecks.uppercase) shouldn't be touched.
    // Let's replace ' uppercase ' with ' ', etc.
    
    // Replace "uppercase " (at start of string/class)
    content = content.replace(/["'`]uppercase /g, match => match[0]);
    // Replace " uppercase" (at end of string/class)
    content = content.replace(/ uppercase["'`]/g, match => match[match.length - 1]);
    // Replace " uppercase " (in middle of string/class)
    content = content.replace(/ uppercase /g, ' ');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
});
