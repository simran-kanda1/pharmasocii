import { Link } from "react-router-dom";

export function Footer() {
    return (
        <footer className="w-full border-t border-foreground/10 bg-background/90 pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mb-12">
                    <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        About
                    </Link>
                    <Link to="/community" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Community
                    </Link>
                    <Link to="/signup" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Become a Partner
                    </Link>
                </div>

                <div className="pt-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center md:items-start gap-2 text-xs text-muted-foreground text-center md:text-left">
                        <p>
                            &copy; {new Date().getFullYear()} Pharma SocII&trade;. All rights reserved.
                        </p>
                        <p>
                            Pharma SocII&trade; is a trademark of Pharma SocII.
                        </p>
                        <p>
                            Pharma SocII is currently offered as an open beta.
                        </p>
                        <p>
                            Unauthorized copying, reproduction, or mirroring of this platform is prohibited.
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
