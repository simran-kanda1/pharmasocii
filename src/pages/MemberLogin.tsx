import { Link } from "react-router-dom";
import { Activity, ArrowLeft, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MemberLogin() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh]">
            {/* Background effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-2xl">
                <div className="inline-flex py-1 px-3 mb-8 rounded-full border border-foreground/10 bg-foreground/5 backdrop-blur-sm text-sm font-medium">
                    <Activity className="w-4 h-4 mr-2 text-primary" /> Member Portal
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                    Coming <span className="text-primary italic">Soon.</span>
                </h1>
                
                <p className="text-xl text-muted-foreground mb-12 max-w-lg leading-relaxed">
                    We're building an exclusive experience for our members. 
                    Be the first to know when the member portal goes live.
                </p>

                <div className="flex flex-col sm:flex-row w-full max-w-md gap-3 mb-12">
                    <div className="relative flex-1">
                        <MailPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            type="email" 
                            placeholder="Enter your email" 
                            className="pl-10 h-12 bg-foreground/5 border-foreground/10 focus-visible:ring-primary/50"
                        />
                    </div>
                    <Button className="h-12 px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                        Notify Me
                    </Button>
                </div>

                <Button variant="ghost" asChild className="hover:bg-primary/10 hover:text-primary">
                    <Link to="/" className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </Button>
            </div>
        </div>
    );
}
