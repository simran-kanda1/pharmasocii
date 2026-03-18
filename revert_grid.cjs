const fs = require('fs');
const file = 'src/pages/AboutUs.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Remove import
lines = lines.filter(l => !l.includes("import { useState } from 'react';"));

// Remove state
lines = lines.filter(l => !l.includes("const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });"));

let content = lines.join('\n');

const bloatedSection = `<section 
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

const cleanSection = `<section className="relative py-24 md:py-32 bg-background overflow-hidden">
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
                    </svg>`;

content = content.replace(bloatedSection, cleanSection);

fs.writeFileSync(file, content, 'utf8');
console.log('Grid successfully reverted to original state');
