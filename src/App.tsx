import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { CookieConsentBanner } from "./components/layout/CookieConsentBanner";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MemberLogin from "./pages/MemberLogin";
import PartnerRegister from "./pages/PartnerRegister";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PartnerDashboard from "./pages/partner/Dashboard";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import MemberRegister from "./pages/MemberRegister";
import MemberForgotPassword from "./pages/member/MemberForgotPassword";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AuthAction from "./pages/AuthAction";
import UnavailableNotice from "./pages/UnavailableNotice";

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
    <>
      <Routes>
        {/* Admin & Partner management - Standalone */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />

        {/* Kept Pages with Layout */}
        <Route path="/" element={<AppLayout><Home /></AppLayout>} />
        <Route path="/about" element={<AppLayout><AboutUs /></AppLayout>} />
        <Route path="/about-us" element={<AppLayout><AboutUs /></AppLayout>} />
        <Route path="/contact" element={<AppLayout><ContactUs /></AppLayout>} />
        <Route path="/contact-us" element={<AppLayout><ContactUs /></AppLayout>} />
        <Route path="/privacy" element={<AppLayout><PrivacyPolicy /></AppLayout>} />
        <Route path="/terms" element={<AppLayout><TermsOfUse /></AppLayout>} />

        {/* Kept Auth & Registration Flows */}
        <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
        <Route path="/member/login" element={<AppLayout><MemberLogin /></AppLayout>} />
        <Route path="/member/forgot-password" element={<AppLayout><MemberForgotPassword /></AppLayout>} />
        <Route path="/forgot-password" element={<AppLayout><MemberForgotPassword /></AppLayout>} />
        <Route path="/signup" element={<AppLayout><PartnerRegister /></AppLayout>} />
        <Route path="/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
        <Route path="/partner/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
        <Route path="/member/register" element={<AppLayout><MemberRegister /></AppLayout>} />
        <Route path="/auth/action" element={<AppLayout><AuthAction /></AppLayout>} />

        {/* All other pages routed to 'Currently unavailable due to technical issues.' */}
        <Route path="/all-categories/:category?" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/listing/:type/:id" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/plans" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/faq" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/community" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/community/post/:postId" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/community/new" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/member/setup" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/member/dashboard" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/guidelines" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/complete-profile" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/add-listing/:type" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/offerings/new" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/jobs/new" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/events/new" element={<AppLayout><UnavailableNotice /></AppLayout>} />
        <Route path="/partner/consulting/new" element={<AppLayout><UnavailableNotice /></AppLayout>} />

        {/* Catch-all */}
        <Route path="*" element={<AppLayout><UnavailableNotice /></AppLayout>} />
      </Routes>
      <CookieConsentBanner />
    </>
  );
}

export default App;
