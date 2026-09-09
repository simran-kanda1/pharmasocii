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
        <div
            role="region"
            aria-label="Cookie consent banner"
            className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
            <div className="container mx-auto max-w-6xl bg-card/95 backdrop-blur-lg border border-foreground/15 rounded-3xl p-6 md:p-7 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                        <Cookie className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 max-w-3xl">
                        <h4 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                            We value your privacy
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            We use essential cookies and analytics cookies to understand traffic and improve performance. No advertising or tracking cookies are used. You can accept or reject all cookies, or read more in our{" "}
                            <Link to="/privacy" className="text-primary underline underline-offset-4 hover:text-primary/80 font-medium">
                                Privacy Policy
                            </Link>.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                    <Button
                        variant="outline"
                        onClick={handleRejectAll}
                        className="flex-1 md:flex-none px-6 py-2.5 h-11 rounded-xl text-sm font-semibold border-foreground/20 hover:bg-foreground/5 transition-colors"
                    >
                        Reject All
                    </Button>
                    <Button
                        variant="default"
                        onClick={handleAcceptAll}
                        className="flex-1 md:flex-none px-7 py-2.5 h-11 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
                    >
                        Accept All
                    </Button>
                </div>
            </div>
        </div>
    );
}
