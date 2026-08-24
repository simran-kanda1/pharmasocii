import { Link } from "react-router-dom";

export function Footer() {
    return (
        <footer className="w-full border-t border-foreground/10 bg-background/90 pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Explore</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/all-categories/business" className="hover:text-primary transition-colors">Business Offerings</Link></li>
                            <li><Link to="/community" className="hover:text-primary transition-colors">Community</Link></li>
                            <li><Link to="/all-categories/consulting" className="hover:text-primary transition-colors">Consulting</Link></li>
                            <li><Link to="/all-categories/events" className="hover:text-primary transition-colors">Events</Link></li>
                            <li><Link to="/all-categories/jobs" className="hover:text-primary transition-colors">Jobs</Link></li>
                            <li><Link to="/all-categories/compliance" className="hover:text-primary transition-colors">Global Health Authority Sites</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Partners</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/signup" className="hover:text-primary transition-colors">Become a Partner</Link></li>
                            <li><Link to="/plans" className="hover:text-primary transition-colors">Plans</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Support</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/about-us" className="hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
                            <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm tracking-wider">Legal</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link to="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link to="/guidelines" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Community Guidelines</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <p className="text-xs text-muted-foreground text-center md:text-left">
                            &copy; {new Date().getFullYear()} Pharma SocII&trade;. All rights reserved.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 max-w-2xl text-center md:text-left">
                            Pharma SocII is currently offered as an open beta. Features may evolve as we continue to improve the platform, see <Link to="/faq" className="underline hover:text-primary transition-colors">FAQs</Link>.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 max-w-2xl text-center md:text-left">
                            Unauthorized copying, reproduction, or mirroring of this platform is prohibited. Pharma SocII&trade; is a trademark of Pharma SocII.
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
