import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Login from "./pages/Login";
import PartnerRegister from "./pages/PartnerRegister";
import CompleteProfile from "./pages/CompleteProfile";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PartnerDashboard from "./pages/partner/Dashboard";
import CreateBusinessOffering from "./pages/partner/CreateBusinessOffering";
import CreateJob from "./pages/partner/CreateJob";
import CreateEvent from "./pages/partner/CreateEvent";
import CreateConsulting from "./pages/partner/CreateConsulting";
import AboutUs from "./pages/AboutUs";

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
      {/* Pages With Layout */}
      <Route path="/" element={<AppLayout><Home /></AppLayout>} />
      <Route path="/about-us" element={<AppLayout><AboutUs /></AppLayout>} />
      <Route path="/marketplace/:category?" element={<AppLayout><Marketplace /></AppLayout>} />

      {/* Auth flows */}
      <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
      <Route path="/signup" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/partner/register" element={<AppLayout><PartnerRegister /></AppLayout>} />
      <Route path="/partner/complete-profile" element={<AppLayout><CompleteProfile /></AppLayout>} />

      {/* Admin specific flows */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />

      {/*
        To be implemented:
        <Route path="/community" element={<AppLayout><Community /></AppLayout>} />
      */}
      <Route path="/partner/dashboard" element={<AppLayout><PartnerDashboard /></AppLayout>} />
      <Route path="/partner/offerings/new" element={<AppLayout><CreateBusinessOffering /></AppLayout>} />
      <Route path="/partner/jobs/new" element={<AppLayout><CreateJob /></AppLayout>} />
      <Route path="/partner/events/new" element={<AppLayout><CreateEvent /></AppLayout>} />
      <Route path="/partner/consulting/new" element={<AppLayout><CreateConsulting /></AppLayout>} />
      <Route path="*" element={<AppLayout><div className="flex-1 flex items-center justify-center text-4xl font-bold p-24">Coming Soon.</div></AppLayout>} />
    </Routes>
  );
}

export default App;
