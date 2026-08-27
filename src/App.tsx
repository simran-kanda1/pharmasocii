import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MemberLogin from "./pages/MemberLogin";
import PartnerRegister from "./pages/PartnerRegister";
import AboutUs from "./pages/AboutUs";
import CommunityFeed from "./pages/community/CommunityFeed";
import CommunityPostDetail from "./pages/community/CommunityPostDetail";
import NewCommunityPost from "./pages/community/NewCommunityPost";
import MemberRegister from "./pages/MemberRegister";
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberCommunitySetup from "./pages/member/MemberCommunitySetup";
import PreviewNotice from "./pages/PreviewNotice";

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const showFooter = location.pathname.replace(/\/$/, "") !== "/community";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground font-sans selection:bg-primary/30 antialiased">
      <Navbar />
      <main className="flex min-h-0 flex-1 w-full flex-col">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Active Preview Pages */}
      <Route path="/" element={<AppLayout><Home /></AppLayout>} />
      <Route path="/about" element={<AppLayout><AboutUs /></AppLayout>} />
      <Route path="/about-us" element={<AppLayout><AboutUs /></AppLayout>} />
      <Route path="/community" element={<AppLayout><CommunityFeed /></AppLayout>} />
      <Route path="/community/post/:postId" element={<AppLayout><CommunityPostDetail /></AppLayout>} />
      <Route path="/community/new" element={<AppLayout><NewCommunityPost /></AppLayout>} />
      <Route path="/signup" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/partner/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/member/register" element={<AppLayout><MemberRegister /></AppLayout>} />
      <Route path="/member/setup" element={<AppLayout><MemberCommunitySetup /></AppLayout>} />
      <Route path="/member/dashboard" element={<AppLayout><MemberDashboard /></AppLayout>} />
      <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
      <Route path="/member/login" element={<AppLayout><MemberLogin /></AppLayout>} />

      {/* Inactive / Preview Notice Pages */}
      <Route path="/preview-notice" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/faq" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/contact" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/contact-us" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/plans" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/all-categories/:category?" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/terms" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/guidelines" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/privacy" element={<AppLayout><PreviewNotice /></AppLayout>} />
      <Route path="/listing/:type/:id" element={<AppLayout><PreviewNotice /></AppLayout>} />

      {/* Catch-all */}
      <Route path="*" element={<AppLayout><PreviewNotice /></AppLayout>} />
    </Routes>
  );
}

export default App;
