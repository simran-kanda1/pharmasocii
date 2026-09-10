import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PreviewNotice() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-24 min-h-[60vh]">
      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
        Coming Soon
      </h1>
      <p className="text-muted-foreground max-w-md mx-auto text-sm md:text-base leading-relaxed mb-8">
        This section is currently under development for the upcoming full platform launch. Please explore the live preview pages.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button asChild variant="default" className="shadow-lg shadow-primary/20">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/about">About Us</Link>
        </Button>
      </div>
    </div>
  );
}
