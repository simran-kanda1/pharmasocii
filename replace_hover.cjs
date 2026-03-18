const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/hover:shadow-xl transition-all duration-300/g, 'hover:-translate-y-2 hover:shadow-2xl transition-all duration-300');
content = content.replace(/hover:shadow-md transition-shadow/g, 'hover:-translate-y-2 hover:shadow-xl transition-all duration-300');

fs.writeFileSync(file, content, 'utf8');
console.log('Hover effects updated');
