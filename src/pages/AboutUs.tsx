import { useEffect } from "react";

export default function AboutUs() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col w-full bg-slate-50/50 min-h-[calc(100vh-4rem)]">
      <section className="relative py-12 sm:py-16 lg:py-20">
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-3">
              About Us
            </h1>
            <p className="text-base sm:text-lg text-slate-600 font-normal">
              Connecting and empowering the global life sciences ecosystem.
            </p>
          </div>

          {/* Unified Master Showcase */}
          <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* The Foundation (Left 7 Cols) */}
            <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between space-y-8 bg-white">
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-2">
                    The Platform
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    The Foundation
                  </h2>
                </div>

                <div className="space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                  <p>
                    We provide a centralized platform and community for the global life sciences ecosystem, bringing businesses, service providers, and professionals together in one structured place.
                  </p>
                  <p>
                    Our platform supports discovery, knowledge sharing, and collaboration that help accelerate projects and advance therapies for patients worldwide.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-r-2xl rounded-l-md bg-blue-50/60 border-l-4 border-primary">
                <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  We are building this ecosystem together.
                </p>
              </div>
            </div>

            {/* Our North Star (Right 5 Cols) */}
            <div className="lg:col-span-5 bg-slate-900 text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden">
              {/* Subtle radiant background glow */}
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 block mb-2">
                    Our Vision
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    Our North Star
                  </h2>
                </div>

                <div className="py-2 sm:py-6">
                  <blockquote className="text-xl sm:text-2xl font-medium text-slate-100 leading-relaxed">
                    “To be the trusted home for collaboration, knowledge, and community in the global life sciences industry.”
                  </blockquote>
                </div>
              </div>

              <div className="relative z-10 pt-6 border-t border-slate-800 flex flex-wrap gap-2 text-xs font-medium text-slate-300">
                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">Collaboration</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">Knowledge</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">Community</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
