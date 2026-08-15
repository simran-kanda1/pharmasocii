import fs from 'fs';

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Add FileText to lucide-react import
    if (!content.includes('FileText')) {
        content = content.replace(/import \{([^}]+)\} from "lucide-react";/, (match, group) => {
            return `import {${group}, FileText} from "lucide-react";`;
        });
    }

    // Replace Event Agenda part in CompleteProfile and AddListing
    // In AddListing it uses eventData.agendaPdfUrl too.
    content = content.replace(
        /<Input\s+type="file"\s+accept="\.pdf,application\/pdf"[\s\S]*?(?:<p className="text-xs text-muted-foreground">Or paste a hosted PDF link.*?<\/p>)\s*<Input\s+type="url"[\s\S]*?\/>/g,
        (match) => {
            const isJob = match.includes('jobDescriptionPdfUrl') || match.includes('jobPdfFile');
            
            if (isJob) {
                // Job Data
                return `{!jobPdfFile && !jobData.jobDescriptionPdfUrl && (
                                                    <Input
                                                        type="file"
                                                        accept=".pdf,application/pdf"
                                                        className="bg-muted/40 border-foreground/10 cursor-pointer"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0] || null;
                                                            setJobPdfFile(f);
                                                            if (f) setJobData((prev) => ({ ...prev, jobDescriptionPdfUrl: "" }));
                                                        }}
                                                    />
                                                )}
                                                {jobPdfFile && (
                                                    <div className="flex items-center gap-2 mt-2 bg-foreground/5 p-2 rounded border border-foreground/10 w-fit">
                                                        <span className="text-xs text-foreground flex items-center gap-1">
                                                            <FileText className="w-4 h-4" /> {jobPdfFile.name}
                                                        </span>
                                                        <button type="button" onClick={() => setJobPdfFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove file">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                                {jobData.jobDescriptionPdfUrl && !jobPdfFile && (
                                                    <div className="flex items-center gap-2 mt-2 bg-foreground/5 p-2 rounded border border-foreground/10 w-fit">
                                                        <a href={jobData.jobDescriptionPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                            <FileText className="w-4 h-4" /> View existing PDF
                                                        </a>
                                                        <button type="button" onClick={() => setJobData(prev => ({ ...prev, jobDescriptionPdfUrl: "" }))} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove file">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}`;
            } else {
                // Event Data
                return `{!eventAgendaPdfFile && !eventData.agendaPdfUrl && (
                                                            <Input
                                                                type="file"
                                                                accept=".pdf,application/pdf"
                                                                className="h-12 bg-muted/40 border-foreground/10 cursor-pointer"
                                                                onChange={(e) => {
                                                                    const f = e.target.files?.[0] || null;
                                                                    setEventAgendaPdfFile(f);
                                                                    if (f) setEventData(prev => ({ ...prev, agendaPdfUrl: "" }));
                                                                }}
                                                            />
                                                        )}
                                                        {eventAgendaPdfFile && (
                                                            <div className="flex items-center gap-2 mt-2 bg-foreground/5 p-2 rounded border border-foreground/10 w-fit">
                                                                <span className="text-xs text-foreground flex items-center gap-1">
                                                                    <FileText className="w-4 h-4" /> {eventAgendaPdfFile.name}
                                                                </span>
                                                                <button type="button" onClick={() => setEventAgendaPdfFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove file">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {eventData.agendaPdfUrl && !eventAgendaPdfFile && (
                                                            <div className="flex items-center gap-2 mt-2 bg-foreground/5 p-2 rounded border border-foreground/10 w-fit">
                                                                <a href={eventData.agendaPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                                    <FileText className="w-4 h-4" /> View existing PDF
                                                                </a>
                                                                <button type="button" onClick={() => setEventData(prev => ({ ...prev, agendaPdfUrl: "" }))} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove file">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}`;
            }
        }
    );

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
}

processFile('src/pages/CompleteProfile.tsx');
processFile('src/pages/partner/AddListing.tsx');
