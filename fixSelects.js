import fs from 'fs';
import path from 'path';

const files = [
  'src/pages/partner/AddListing.tsx',
  'src/pages/CompleteProfile.tsx',
];

for (const file of files) {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const newContent = content.replace(/bg-background\/90/g, 'bg-background');
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`Updated ${file}`);
    }
  }
}
