const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Make the Cross pattern strictly 'blue' (sky-500) and less prominent (opacity-[0.015])
content = content.replace(
    /className="absolute inset-0 w-full h-full opacity-\[0\.03\]"/,
    'className="absolute inset-0 w-full h-full opacity-[0.015]"'
);

content = content.replace(
    /className="text-foreground"\s*\/>/g,
    'className="text-sky-500" />'
);

// 2. Make all Core value tiles completely opaque (bg-background instead of bg-foreground/5) so you can't see the grid through them
content = content.replace(
    /bg-foreground\/5 hover:bg-background/g,
    'bg-background'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Background updated to blue/faint, cards rendered opaque');
