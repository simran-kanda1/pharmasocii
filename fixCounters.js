import fs from 'fs';

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // 1. Remove (max ...) from Labels
    const maxRegex = /<span className="[^"]*">\s*\(max [^)]+\)\s*<\/span>/g;
    if (maxRegex.test(content)) {
        content = content.replace(maxRegex, '');
        changed = true;
    }
    
    // Also catch any `(max ...)` that might just be text inside a label
    const plainMaxRegex = /\s*\(max [^)]+\)/g;
    if (plainMaxRegex.test(content)) {
        // Only replace inside <Label> or <label> to be safe
        content = content.replace(/(<Label[^>]*>)(.*?)(<\/Label>)/g, (match, open, inner, close) => {
            if (inner.includes('(max ')) {
                return open + inner.replace(plainMaxRegex, '') + close;
            }
            return match;
        });
        changed = true;
    }

    // 2. Fix CompleteProfile.tsx / Dashboard.tsx missing text-right or having ' characters'
    // E.g. <p className={`text-xs ${...}`}>{...} characters</p> -> <p className={`text-xs text-right ${...}`}>{...}</p>
    const countRegex = /<p className=\{`text-xs ([^`]*)`\}>(\{.*?\})\/(.*?)(\s+characters)?<\/p>/g;
    content = content.replace(countRegex, (match, classes, val1, val2, chars) => {
        if (!classes.includes('text-right')) {
            classes = 'text-right ' + classes;
        }
        changed = true;
        return `<p className={\`text-xs ${classes}\`}>${val1}/${val2}</p>`;
    });

    const countRegex2 = /<p className="text-xs ([^"]*)"\>(\{.*?\})\/(\{.*?\})<\/p>/g;
    content = content.replace(countRegex2, (match, classes, val1, val2) => {
        if (!classes.includes('text-right')) {
            classes = 'text-right ' + classes;
        }
        changed = true;
        return `<p className="text-xs ${classes}">${val1}/${val2}</p>`;
    });

    // 3. MemberRegister.tsx and MemberCommunitySetup.tsx and NewCommunityPost.tsx
    // They have: 
    // <div className="flex justify-between items-center">
    //   <Label ...>...</Label>
    //   <span className={...}>{...}/{...}</span>
    // </div>
    // <Input ... />
    // We want to transform to:
    // <div className="space-y-2"> (or whatever wrapper)
    //   <Label ...>...</Label>
    //   <Input ... />
    //   <p className={`text-xs text-right ...`}>{...}/{...}</p>
    // </div>
    
    const flexCountRegex = /<div className="flex justify-between items-center(?: mb-2)?">\s*(<Label[^>]*>.*?<\/Label>)\s*<span className=\{`text-\[[^\]]+\] ([^`]*)`\}>(\{.*?\})\/([0-9A-Z_]+)<\/span>\s*<\/div>\s*(<Input[^>]*\/>)/g;
    content = content.replace(flexCountRegex, (match, label, classes, val1, val2, input) => {
        changed = true;
        return `${label}\n            ${input}\n            <p className={\`text-xs text-right \${${classes.includes('text-red-500') ? `'${classes}'` : `''`}}\`}>${val1}/${val2}</p>`;
    });
    
    // Also handle NewCommunityPost.tsx specifically which uses different classes
    const newCommRegex = /<div className="flex justify-between items-center mb-2">\s*(<Label[^>]*>.*?<\/Label>)\s*<span className=\{`text-xs ([^`]*)`\}>(\{.*?\})\/([0-9A-Z_]+)<\/span>\s*<\/div>\s*(<Input[^>]*\/>)/g;
    content = content.replace(newCommRegex, (match, label, classes, val1, val2, input) => {
        changed = true;
        return `${label}\n          ${input}\n          <p className={\`text-xs text-right \${${classes.includes('text-red-500') ? `'${classes}'` : `''`}}\`}>${val1}/${val2}</p>`;
    });

    // Handle NewCommunityPost title span replacement explicitly because of template literals
    const newCommRegex2 = /<div className="flex justify-between items-center mb-2">\s*(<Label htmlFor="title" className="text-base font-semibold">Title <span className="text-red-500">\*<\/span><\/Label>)\s*<span className=\{`text-xs \$\{title\.length >= POST_TITLE_MAX \? 'text-red-500 font-bold' : 'text-muted-foreground'\}`\}\>\{title\.length\}\/\{POST_TITLE_MAX\}<\/span>\s*<\/div>\s*(<Input[\s\S]*?\/>)/g;
    content = content.replace(newCommRegex2, (match, label, input) => {
        changed = true;
        return `${label}\n          ${input}\n          <p className={\`text-xs text-right \${title.length >= POST_TITLE_MAX ? 'text-red-500 font-bold' : 'text-muted-foreground'}\`}>{title.length}/{POST_TITLE_MAX}</p>`;
    });

    // Handle MemberRegister explicit replacements to be safe
    const memRegUser = /<div className="flex justify-between items-center">\s*(<Label htmlFor="userName">Username\*<\/Label>)\s*<span className=\{`text-\[11px\] \$\{form\.userName\.length >= 15 \? 'text-red-500 font-bold' : 'text-muted-foreground'\}`\}>\{form\.userName\.length\}\/15<\/span>\s*<\/div>\s*(<Input[\s\S]*?className="bg-foreground\/5 border-foreground\/10"\s*\/>)/g;
    content = content.replace(memRegUser, (match, label, input) => {
        changed = true;
        return `${label}\n            ${input}\n            <p className={\`text-[11px] text-right mt-1 \${form.userName.length >= 15 ? 'text-red-500 font-bold' : 'text-muted-foreground'}\`}>{form.userName.length}/15</p>`;
    });

    const memRegAbout = /<div className="flex justify-between items-center">\s*(<Label htmlFor="aboutMe">About me \(Tagline\)<\/Label>)\s*<span className=\{`text-\[11px\] \$\{form\.aboutMe\.length >= 25 \? 'text-red-500 font-bold' : 'text-muted-foreground'\}`\}>\{form\.aboutMe\.length\}\/25<\/span>\s*<\/div>\s*(<Input[\s\S]*?className="bg-foreground\/5 border-foreground\/10"\s*\/>)/g;
    content = content.replace(memRegAbout, (match, label, input) => {
        changed = true;
        return `${label}\n            ${input}\n            <p className={\`text-[11px] text-right mt-1 \${form.aboutMe.length >= 25 ? 'text-red-500 font-bold' : 'text-muted-foreground'}\`}>{form.aboutMe.length}/25</p>`;
    });

    // MemberCommunitySetup
    const memCommUser = /<div className="flex justify-between items-center">\s*(<Label htmlFor="userName">Username\*<\/Label>)\s*<span className=\{`text-\[11px\] \$\{userName\.length >= 15 \? 'text-red-500 font-bold' : 'text-muted-foreground'\}`\}>\{userName\.length\}\/15<\/span>\s*<\/div>\s*(<Input[\s\S]*?className="bg-foreground\/5 border-foreground\/10"\s*\/>)/g;
    content = content.replace(memCommUser, (match, label, input) => {
        changed = true;
        return `${label}\n            ${input}\n            <p className={\`text-[11px] text-right mt-1 \${userName.length >= 15 ? 'text-red-500 font-bold' : 'text-muted-foreground'}\`}>{userName.length}/15</p>`;
    });

    const memCommAbout = /<div className="flex justify-between items-center">\s*(<Label htmlFor="aboutMe">About me \(Tagline\)<\/Label>)\s*<span className=\{`text-\[11px\] \$\{aboutMe\.length >= 25 \? 'text-red-500 font-bold' : 'text-muted-foreground'\}`\}>\{aboutMe\.length\}\/25<\/span>\s*<\/div>\s*(<Input[\s\S]*?className="bg-foreground\/5 border-foreground\/10"\s*\/>)/g;
    content = content.replace(memCommAbout, (match, label, input) => {
        changed = true;
        return `${label}\n            ${input}\n            <p className={\`text-[11px] text-right mt-1 \${aboutMe.length >= 25 ? 'text-red-500 font-bold' : 'text-muted-foreground'}\`}>{aboutMe.length}/25</p>`;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

const pagesDir = 'src/pages';
function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = dir + '/' + file;
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

traverse(pagesDir);
