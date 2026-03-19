import { Link } from "react-router-dom";
import { Twitter, Linkedin, Facebook, Instagram } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full border-t border-foreground/10 bg-background/90 pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="md:col-span-1 space-y-4">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                <div className="h-3 w-3 bg-foreground/20 rounded-full" />
                            </div>
                            <span className="font-bold text-lg tracking-tight">Pharmasocii</span>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                            Discover, Connect & Collaborate Building connections across the life sciences ecosystem.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <a href="#" className="h-8 w-8 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-foreground transition-all">
                                <Twitter className="h-4 w-4" />
                            </a>
                            <a href="#" className="h-8 w-8 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-foreground transition-all">
                                <Linkedin className="h-4 w-4" />
                            </a>
                            <a href="#" className="h-8 w-8 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-foreground transition-all">
                                <Facebook className="h-4 w-4" />
                            </a>
                            <a href="#" className="h-8 w-8 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-foreground transition-all">
                                <Instagram className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm uppercase tracking-wider">All Categories</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/all-categories/business" className="hover:text-primary transition-colors">Businesses</Link></li>
                            <li><Link to="/all-categories/experts" className="hover:text-primary transition-colors">Experts</Link></li>
                            <li><Link to="/all-categories/events" className="hover:text-primary transition-colors">Events</Link></li>
                            <li><Link to="/all-categories/jobs" className="hover:text-primary transition-colors">Jobs</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm uppercase tracking-wider">Company</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link to="/community" className="hover:text-primary transition-colors">Community</Link></li>
                            <li><Link to="/partner" className="hover:text-primary transition-colors">Become a Partner</Link></li>
                            <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm uppercase tracking-wider">Legal</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link to="/guidelines" className="hover:text-primary transition-colors">Community Guidelines</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground text-center">
                        &copy; {new Date().getFullYear()} Pharmasocii. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                        <span>Discover, Connect & Collaborate</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
