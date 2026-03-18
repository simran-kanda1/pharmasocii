const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(directoryPath);

const replacements = [
    { from: /bg-white\/5/g, to: 'bg-black/5' },
    { from: /bg-white\/10/g, to: 'bg-black/10' },
    { from: /bg-white\/20/g, to: 'bg-black/20' },
    { from: /border-white\/5/g, to: 'border-black/5' },
    { from: /border-white\/10/g, to: 'border-black/10' },
    { from: /border-white\/20/g, to: 'border-black/20' },
    { from: /bg-black\/40/g, to: 'bg-slate-100' },
    { from: /bg-black\/50/g, to: 'bg-slate-200' },
    { from: /bg-black\/60/g, to: 'bg-slate-50' },
    { from: /text-white\/80/g, to: 'text-muted-foreground' },
    { from: /text-white\/70/g, to: 'text-muted-foreground' },
    { from: /text-white\b/g, to: 'text-foreground' },
    { from: /bg-background\/50/g, to: 'bg-white/50' },
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    replacements.forEach(({ from, to }) => {
        content = content.replace(from, to);
    });
    
    // Some fixups for buttons where text-foreground replaced text-white but the button itself is primary
    content = content.replace(/className="([^"]*)text-foreground([^"]*)bg-primary([^"]*)"/g, (match, p1, p2, p3) => {
        return `className="${p1}text-white${p2}bg-primary${p3}"`;
    });
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
