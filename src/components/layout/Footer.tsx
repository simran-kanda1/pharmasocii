import { Link } from "react-router-dom";

export function Footer() {
    return (
        <footer className="w-full border-t border-foreground/10 bg-background/90 pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Explore</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/all-categories/business" className="hover:text-primary transition-colors">Business Offerings</Link></li>
                            <li><Link to="/all-categories/consulting" className="hover:text-primary transition-colors">Consulting Services</Link></li>
                            <li><Link to="/all-categories/events" className="hover:text-primary transition-colors">Events</Link></li>
                            <li><Link to="/all-categories/jobs" className="hover:text-primary transition-colors">Jobs</Link></li>
                            <li><Link to="/all-categories/compliance" className="hover:text-primary transition-colors">Global Health Authority Sites</Link></li>
                            <li><Link to="/community" className="hover:text-primary transition-colors">Community</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Company</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/about-us" className="hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link to="/plans" className="hover:text-primary transition-colors">Plans</Link></li>
                            <li><Link to="/signup" className="hover:text-primary transition-colors">Become a Partner</Link></li>
                            <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Legal</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Privacy &amp; legal</Link></li>
                            <li><Link to="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link to="/guidelines" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Community Guidelines</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <p className="text-xs text-muted-foreground text-center md:text-left">
                            &copy; {new Date().getFullYear()} Pharma SocII. All rights reserved.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 max-w-sm text-center md:text-left">
                            This product is in open beta. We welcome your input as we continue to refine the experience.
                        </p>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                        <span>Discover, Connect & Collaborate</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
