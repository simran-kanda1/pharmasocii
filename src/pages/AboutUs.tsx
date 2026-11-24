import { useEffect } from "react";
import { Compass, Building2 } from "lucide-react";

export default function AboutUs() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)]">
      <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          {/* Side by side layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            {/* The Foundation */}
            <div className="rounded-3xl border border-foreground/10 bg-card p-8 sm:p-10 md:p-12 shadow-lg shadow-black/[0.03] flex flex-col justify-between space-y-8 hover:border-primary/30 transition-all duration-300">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    The Foundation
                  </h1>
                </div>

                <div className="space-y-4 text-base sm:text-lg text-muted-foreground leading-relaxed font-normal">
                  <p>
                    We provide a centralized platform and community for the global life sciences ecosystem, bringing businesses, service providers, and professionals together in one structured place.
                  </p>
                  <p>
                    Our platform supports discovery, knowledge sharing, and collaboration that help accelerate projects and advance therapies for patients worldwide.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-foreground/5 border-l-4 border-primary">
                <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  We are building this ecosystem together.
                </p>
              </div>
            </div>

            {/* Our North Star */}
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-primary/[0.02] p-8 sm:p-10 md:p-12 shadow-xl shadow-primary/[0.04] flex flex-col justify-between space-y-8 hover:border-primary/35 transition-all duration-300 relative overflow-hidden">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Our North Star
                  </h2>
                </div>

                <div className="py-4 sm:py-8">
                  <blockquote className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground/90 leading-relaxed sm:leading-snug">
                    “To be the trusted home for collaboration, knowledge, and community in the global life sciences industry.”
                  </blockquote>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-primary/10 text-xs font-medium text-muted-foreground">
                <span className="px-3 py-1 rounded-full bg-background/80 border border-border shadow-xs">Collaboration</span>
                <span className="px-3 py-1 rounded-full bg-background/80 border border-border shadow-xs">Knowledge</span>
                <span className="px-3 py-1 rounded-full bg-background/80 border border-border shadow-xs">Community</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
