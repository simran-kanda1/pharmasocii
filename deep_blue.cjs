const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace cyan rgba with a deeper blue (Tailwind blue-600: 37, 99, 235)
content = content.replace(/rgba\(6,182,212,0\.4\)/g, 'rgba(37,99,235,0.5)');

// Replace cyan-500 tailwind shadow with a deeper blue-600 shadow
content = content.replace(/hover:shadow-cyan-500\/30/g, 'hover:shadow-blue-600/40');

fs.writeFileSync(file, content);
console.log('Blue glows deepened on all cards');
