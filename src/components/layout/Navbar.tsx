import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ChevronDown, Menu, LogOut, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, db } from "@/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [businessName, setBusinessName] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Try grabbing partner logic
                const docRef = doc(db, "partnersCollection", currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().businessName) {
                    setBusinessName(docSnap.data().businessName);
                } else {
                    // Fallback to member email if not fully fleshed out
                    setBusinessName(currentUser.email?.split('@')[0] || "User");
                }
            } else {
                setBusinessName("");
            }
        });

        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await signOut(auth);
        navigate("/login");
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-6 md:gap-10">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-4 w-4 bg-foreground/20 rounded-full" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-foreground">
                            Pharmasocii
                        </span>
                    </Link>

                    <div className="hidden lg:flex items-center gap-6">
                        <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
                            Home
                        </Link>
                        <Link to="/about-us" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground">
                            About Us
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors text-muted-foreground outline-none">
                                All Categories <ChevronDown className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-background border-foreground/10 shadow-2xl">
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/marketplace/business">Business</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/marketplace/consulting">Consulting Services</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/marketplace/events">Events</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/marketplace/jobs">Jobs</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link to="/community" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground">
                            Community
                        </Link>
                        <Link to="/faq" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground">
                            FAQ
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">

                    <div className="hidden sm:flex items-center gap-2">
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-foreground/10 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground transition-all flex items-center gap-2">
                                        <User className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-sm max-w-[120px] truncate">{businessName}</span>
                                        <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-background/90 border-foreground/10 shadow-2xl backdrop-blur-xl">
                                    <DropdownMenuItem className="p-3 focus:bg-foreground/5 cursor-pointer" onClick={() => navigate("/partner/dashboard")}>
                                        <LayoutDashboard className="w-4 h-4 mr-2 text-primary" />
                                        <span>My Dashboard</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-foreground/10" />
                                    <DropdownMenuItem className="p-3 focus:bg-destructive/20 focus:text-destructive cursor-pointer" onClick={handleSignOut}>
                                        <LogOut className="w-4 h-4 mr-2" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <>
                                <Button variant="ghost" asChild className="hover:bg-primary/20 hover:text-primary">
                                    <Link to="/login">Login</Link>
                                </Button>
                                <Button asChild className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                                    <Link to="/signup">Get Started</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    <Button variant="ghost" size="icon" className="lg:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </div>
            </div>
        </nav>
    );
}
