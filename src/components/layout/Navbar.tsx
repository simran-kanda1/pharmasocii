import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, LogOut, LayoutDashboard, User, Search } from "lucide-react";
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
    const [userName, setUserName] = useState("");
    const [isPartner, setIsPartner] = useState(false);
    const [hasMemberProfile, setHasMemberProfile] = useState(false);
    const [navSearch, setNavSearch] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                let nameToSet = "";
                try {
                    const memberSnap = await getDoc(doc(db, "membersCollection", currentUser.uid));
                    const partnerSnap = await getDoc(doc(db, "partnersCollection", currentUser.uid));
                    setIsPartner(partnerSnap.exists());
                    setHasMemberProfile(memberSnap.exists());
                    if (memberSnap.exists() && memberSnap.data().name) {
                        nameToSet = memberSnap.data().name.split(" ")[0];
                    } else if (partnerSnap.exists() && partnerSnap.data().primaryName) {
                        nameToSet = partnerSnap.data().primaryName.split(" ")[0];
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
                setIsPartner(false);
                setHasMemberProfile(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const submitNavSearch = (e: FormEvent) => {
        e.preventDefault();
        const q = navSearch.trim();
        if (!q) {
            navigate("/community");
            return;
        }
        navigate(`/community?search=${encodeURIComponent(q)}`);
    };

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
                        <Link to="/faq" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground">
                            FAQ
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors text-muted-foreground outline-none">
                                All Categories <ChevronDown className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[14rem] bg-background border-foreground/10 shadow-2xl">
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link to="/community" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground">
                            Community
                        </Link>
                    </div>
                </div>

                <form onSubmit={submitNavSearch} className="hidden md:flex flex-1 max-w-xs mx-4 items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={navSearch}
                            onChange={(e) => setNavSearch(e.target.value)}
                            placeholder="Search community…"
                            className="h-9 pl-8 bg-foreground/5 border-foreground/10 text-sm"
                        />
                    </div>
                </form>

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
                                    {hasMemberProfile && (
                                        <DropdownMenuItem className="p-3 focus:bg-foreground/5 cursor-pointer" onClick={() => navigate("/member/dashboard")}>
                                            <User className="w-4 h-4 mr-2 text-primary" />
                                            <span>Member dashboard</span>
                                        </DropdownMenuItem>
                                    )}
                                    {!hasMemberProfile && (
                                        <DropdownMenuItem className="p-3 focus:bg-foreground/5 cursor-pointer" onClick={() => navigate("/member/setup")}>
                                            <User className="w-4 h-4 mr-2 text-primary" />
                                            <span>Create community profile</span>
                                        </DropdownMenuItem>
                                    )}
                                    {isPartner && (
                                        <DropdownMenuItem className="p-3 focus:bg-foreground/5 cursor-pointer" onClick={() => navigate("/partner/dashboard")}>
                                            <LayoutDashboard className="w-4 h-4 mr-2 text-primary" />
                                            <span>Partner dashboard</span>
                                        </DropdownMenuItem>
                                    )}
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
                                <Button asChild variant="outline" className="hidden lg:inline-flex">
                                    <Link to="/member/register">Join community</Link>
                                </Button>
                                <Button asChild className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                                    <Link to="/signup">Become a partner</Link>
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
