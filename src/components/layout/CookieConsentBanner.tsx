import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "pharmasocii_cookie_consent";

export function CookieConsentBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consent) {
            // Small delay so it animates in smoothly after initial mount
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAcceptAll = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
        setIsVisible(false);
    };

    const handleRejectAll = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <aside
            role="region"
            aria-label="Cookie consent banner"
            className="fixed bottom-4 left-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-96 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
            <div className="bg-card/95 backdrop-blur-lg border border-foreground/15 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                        <Cookie className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                        We value your privacy
                    </h4>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                    We use essential cookies and analytics cookies to understand traffic and improve performance. No advertising or tracking cookies are used. You can accept or reject all cookies, or read more in our{" "}
                    <Link to="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                        Privacy Policy
                    </Link>.
                </p>

                <div className="flex items-center gap-2.5 pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRejectAll}
                        className="flex-1 h-9 rounded-xl text-xs font-semibold border-foreground/20 hover:bg-foreground/5 transition-colors"
                    >
                        Reject All
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleAcceptAll}
                        className="flex-1 h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
                    >
                        Accept All
                    </Button>
                </div>
            </div>
        </aside>
    );
}
