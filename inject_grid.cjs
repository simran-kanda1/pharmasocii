const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports if needed
if (!content.includes('import { useState }')) {
    content = "import { useState } from 'react';\n" + content;
}

// 2. Add state hook inside AboutUs
if (!content.includes('const [mousePos')) {
    content = content.replace(
        'export default function AboutUs() {',
        'export default function AboutUs() {\n    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });'
    );
}

// 3. Update the Core Values section block
const oldPatternRegex = /<section className="relative py-24 md-?:py-32 bg-background overflow-hidden">[\s\S]*?<svg className="absolute inset-0 w-full h-full opacity-\[0\.05\]" xmlns="http:\/\/www.w3.org\/2000\/svg">[\s\S]*?<\/svg>/;

const replacement = `<section 
                className="relative py-24 md:py-32 bg-background overflow-hidden"
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setMousePos({ x: -1000, y: -1000 })}
            >
                {/* Background Decorations */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {/* Blue Tech Grid Lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid-lines" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-lines)" className="text-secondary" />
                    </svg>

                    {/* Glow Tech Grid Lines (Follows Mouse) */}
                    <svg 
                        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300" 
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                            maskImage: \`radial-gradient(500px circle at \${mousePos.x}px \${mousePos.y}px, black 0%, transparent 100%)\`,
                            WebkitMaskImage: \`radial-gradient(500px circle at \${mousePos.x}px \${mousePos.y}px, black 0%, transparent 100%)\`
                        }}
                    >
                        <defs>
                            <pattern id="grid-lines-glow" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="2.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-lines-glow)" className="text-sky-500 opacity-60" />
                    </svg>`;

content = content.replace(oldPatternRegex, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Interactive grid implemented!');
