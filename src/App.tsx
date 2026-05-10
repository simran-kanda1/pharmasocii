import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import Home from "./pages/Home";
import AllCategories from "./pages/AllCategories";
import Login from "./pages/Login";
import MemberLogin from "./pages/MemberLogin";
import PartnerRegister from "./pages/PartnerRegister";
import CompleteProfile from "./pages/CompleteProfile";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PartnerDashboard from "./pages/partner/Dashboard";
import ListingDetail from "./pages/ListingDetail";
import AddListing from "./pages/partner/AddListing";
import AboutUs from "./pages/AboutUs";
import FAQ from "./pages/FAQ";
import CommunityFeed from "./pages/community/CommunityFeed";
import CommunityPostDetail from "./pages/community/CommunityPostDetail";
import NewCommunityPost from "./pages/community/NewCommunityPost";
import MemberRegister from "./pages/MemberRegister";
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberCommunitySetup from "./pages/member/MemberCommunitySetup";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 antialiased">
      <Navbar />
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Admin specific flows - NO layout, standalone pages */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />

      {/* Partner dashboard - NO layout */}
      <Route path="/partner/dashboard" element={<PartnerDashboard />} />

      {/* Pages With Layout */}
      <Route path="/" element={<AppLayout><Home /></AppLayout>} />
      <Route path="/listing/:type/:id" element={<AppLayout><ListingDetail /></AppLayout>} />
      <Route path="/about-us" element={<AppLayout><AboutUs /></AppLayout>} />
      <Route path="/faq" element={<AppLayout><FAQ /></AppLayout>} />
      <Route path="/all-categories/:category?" element={<AppLayout><AllCategories /></AppLayout>} />

      <Route path="/community" element={<AppLayout><CommunityFeed /></AppLayout>} />
      <Route path="/community/post/:postId" element={<AppLayout><CommunityPostDetail /></AppLayout>} />
      <Route path="/community/new" element={<AppLayout><NewCommunityPost /></AppLayout>} />
      <Route path="/member/register" element={<AppLayout><MemberRegister /></AppLayout>} />
      <Route path="/member/setup" element={<AppLayout><MemberCommunitySetup /></AppLayout>} />
      <Route path="/member/dashboard" element={<AppLayout><MemberDashboard /></AppLayout>} />

      {/* Auth flows */}
      <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
      <Route path="/member/login" element={<AppLayout><MemberLogin /></AppLayout>} />
      <Route path="/signup" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/partner/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/partner/complete-profile" element={<AppLayout><CompleteProfile /></AppLayout>} />

      {/* Partner listing pages */}
      <Route path="/partner/add-listing/:type" element={<AppLayout><AddListing /></AppLayout>} />
      <Route path="/partner/offerings/new" element={<AppLayout><AddListing /></AppLayout>} />
      <Route path="/partner/jobs/new" element={<AppLayout><AddListing /></AppLayout>} />
      <Route path="/partner/events/new" element={<AppLayout><AddListing /></AppLayout>} />
      <Route path="/partner/consulting/new" element={<AppLayout><AddListing /></AppLayout>} />

      {/* Catch-all */}
      <Route path="*" element={<AppLayout><div className="flex-1 flex items-center justify-center text-4xl font-bold p-24">Coming Soon.</div></AppLayout>} />
    </Routes>
  );
}

export default App;
