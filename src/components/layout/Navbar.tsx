import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, LogOut, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    const [userName, setUserName] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                let nameToSet = "";
                try {
                    // Check membersCollection first
                    const memberSnap = await getDoc(doc(db, "membersCollection", currentUser.uid));
                    if (memberSnap.exists() && memberSnap.data().name) {
                        nameToSet = memberSnap.data().name.split(" ")[0];
                    } else {
                        // Check partnersCollection
                        const partnerSnap = await getDoc(doc(db, "partnersCollection", currentUser.uid));
                        if (partnerSnap.exists() && partnerSnap.data().primaryName) {
                            nameToSet = partnerSnap.data().primaryName.split(" ")[0];
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user data", error);
                }
                
                // Fallback to email prefix or "User"
                if (!nameToSet) {
                    nameToSet = currentUser.displayName?.split(" ")[0] || currentUser.email?.split("@")[0] || "User";
                }
                
                setUserName(nameToSet);
            } else {
                setUserName("");
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
                                    <Link to="/all-categories/business">Business Offerings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/all-categories/consulting">Consulting Services</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/all-categories/events">Events</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/all-categories/jobs">Jobs</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/all-categories/compliance">Global Health Authority Sites</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex items-center gap-4">

                    <div className="hidden sm:flex items-center gap-2">
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-foreground/10 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground transition-all flex items-center gap-2">
                                        <User className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-sm max-w-[120px] truncate">{userName}</span>
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
                                <div className="relative group">
                                    <Button variant="ghost" className="hover:bg-primary/20 hover:text-primary flex items-center gap-1">
                                        Login <ChevronDown className="w-3 h-3 transition-transform group-hover:rotate-180" />
                                    </Button>
                                    <div className="absolute top-[100%] right-0 pt-2 w-32 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <div className="bg-background border border-foreground/10 shadow-2xl rounded-md flex flex-col p-1">
                                            <Link to="/login?type=partner" className="px-3 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary rounded-sm transition-colors w-full text-left">
                                                Partner
                                            </Link>
                                            <Link to="/member/login" className="px-3 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary rounded-sm transition-colors w-full text-left">
                                                Member
                                            </Link>
                                        </div>
                                    </div>
                                </div>
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
