const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the glowing orbs background block
content = content.replace(
    /\{\/\* Soft Glowing Orbs \*\/\}\s*<div className="absolute top-0 right-0 -translate-y-1\/4 translate-x-1\/4 w-\[600px\] h-\[600px\] bg-primary\/10 rounded-full blur-\[100px\]" \/>\s*<div className="absolute bottom-0 left-0 translate-y-1\/4 -translate-x-1\/4 w-\[600px\] h-\[600px\] bg-sky-400\/10 rounded-full blur-\[100px\]" \/>/,
    ''
);

// Add blue glow to hover states
content = content.replace(
    /hover:shadow-xl transition-all duration-300/g,
    'hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms]'
);

// We need to also check if we used hover:shadow-2xl for something else (like Mission & Vision) and add glow there too
content = content.replace(
    /hover:shadow-2xl transition-all duration-300/g,
    'hover:shadow-[0_0_50px_-12px_rgba(6,182,212,0.4)] transition-all duration-[400ms]'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Orbs removed and dynamic glow added to hover states');
