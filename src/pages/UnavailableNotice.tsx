import { Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnavailableNotice() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-24 min-h-[60vh]">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mb-6 shadow-sm">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4 max-w-2xl leading-tight">
        Currently unavailable due to technical issues.
      </h1>
      <p className="text-muted-foreground max-w-md mx-auto text-sm md:text-base leading-relaxed mb-8">
        We apologize for the inconvenience. Our team is actively working to restore this service. Please check back shortly.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button asChild variant="default" className="shadow-lg shadow-primary/20">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/contact">Contact Support</Link>
        </Button>
      </div>
    </div>
  );
}
