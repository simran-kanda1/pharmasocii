import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Eye, Shield, Users, ArrowUpCircle, HeartHandshake, Leaf, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutUs() {
    return (
        <div className="flex flex-col w-full bg-background mt-16">
            {/* SECTION 1: HERO */}
            <section className="relative py-20 md:py-32 overflow-hidden bg-background">
                {/* Floating Microscopic Cells Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <svg className="absolute w-[120%] h-[120%] -left-[10%] -top-[10%]" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <filter id="cell-blur" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
                            </filter>
                            <filter id="core-blur" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                            </filter>
                        </defs>

                        {/* Cell Group 1 - Top Left */}
                        <g className="text-primary opacity-40 drop-shadow-lg">
                            <animateTransform attributeName="transform" type="translate" values="0,0; 150,100; -50,50; 0,0" dur="25s" repeatCount="indefinite" />
                            <circle cx="15%" cy="25%" r="80" fill="currentColor" opacity="0.4" filter="url(#cell-blur)" />
                            <circle cx="15%" cy="25%" r="30" fill="currentColor" opacity="0.8" filter="url(#core-blur)" />
                        </g>

                        {/* Cell Group 2 - Top Right */}
                        <g className="text-blue-500 opacity-30 drop-shadow-lg">
                            <animateTransform attributeName="transform" type="translate" values="0,0; -120,150; -80,-50; 0,0" dur="28s" repeatCount="indefinite" />
                            <circle cx="85%" cy="30%" r="100" fill="currentColor" opacity="0.3" filter="url(#cell-blur)" />
                            <circle cx="85%" cy="30%" r="40" fill="currentColor" opacity="0.6" filter="url(#core-blur)" />
                        </g>

                        {/* Cell Group 3 - Bottom Center */}
                        <g className="text-cyan-600 opacity-40 drop-shadow-lg">
                            <animateTransform attributeName="transform" type="translate" values="0,0; 180,-120; 50,-100; 0,0" dur="32s" repeatCount="indefinite" />
                            <circle cx="50%" cy="80%" r="90" fill="currentColor" opacity="0.3" filter="url(#cell-blur)" />
                            <circle cx="50%" cy="80%" r="35" fill="currentColor" opacity="0.6" filter="url(#core-blur)" />
                        </g>

                        {/* Cell Group 4 - Bottom Left */}
                        <g className="text-primary opacity-30 drop-shadow-lg">
                            <animateTransform attributeName="transform" type="translate" values="0,0; -100,-150; 100,-80; 0,0" dur="24s" repeatCount="indefinite" />
                            <circle cx="20%" cy="75%" r="60" fill="currentColor" opacity="0.4" filter="url(#cell-blur)" />
                            <circle cx="20%" cy="75%" r="25" fill="currentColor" opacity="0.7" filter="url(#core-blur)" />
                        </g>

                        {/* Cell Group 5 - Center Right */}
                        <g className="text-blue-400 opacity-40 drop-shadow-lg">
                            <animateTransform attributeName="transform" type="translate" values="0,0; 150,80; 50,150; 0,0" dur="26s" repeatCount="indefinite" />
                            <circle cx="75%" cy="60%" r="70" fill="currentColor" opacity="0.3" filter="url(#cell-blur)" />
                            <circle cx="75%" cy="60%" r="30" fill="currentColor" opacity="0.6" filter="url(#core-blur)" />
                        </g>
                    </svg>

                    {/* Lighter Gradient overlays to ensure visibility */}
                    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />
                </div>

                <div className="container relative z-10 mx-auto px-4 max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div className="space-y-8">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] text-foreground leading-[1.1]">
                                Connecting People and Ideas in Life Sciences
                            </h1>
                            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl font-light">
                                We are passionate about bringing together professionals, organizations, and innovators across healthcare and life sciences to foster meaningful collaboration and drive progress.
                            </p>
                        </div>
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[400px] md:h-[600px] border border-foreground/10">
                            <img
                                src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200"
                                alt="Biotech Innovation"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-primary/10 mix-blend-multiply pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2: MISSION & VISION */}
            <section className="py-24 bg-sky-50/50 border-y border-foreground/5">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Our Mission & Vision</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                        <Card className="bg-background border-foreground/10 p-10 md:p-12 shadow-lg hover:-translate-y-2 hover:shadow-[0_0_50px_-12px_rgba(6,182,212,0.4)] transition-all duration-[400ms] rounded-[2rem]">
                            <div className="bg-primary/10 w-16 h-16 flex items-center justify-center rounded-2xl mb-8">
                                <Target className="text-primary w-8 h-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-foreground mb-4 tracking-tight">Mission</h3>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Advancing healthcare through collaboration, accessibility, trust, and meaningful relationships.
                            </p>
                        </Card>

                        <Card className="bg-background border-foreground/10 p-10 md:p-12 shadow-lg hover:-translate-y-2 hover:shadow-[0_0_50px_-12px_rgba(6,182,212,0.4)] transition-all duration-[400ms] rounded-[2rem]">
                            <div className="bg-blue-600/10 w-16 h-16 flex items-center justify-center rounded-2xl mb-8">
                                <Eye className="text-blue-600 w-8 h-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-foreground mb-4 tracking-tight">Vision</h3>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Serving as a trusted source for collaboration and information in the life sciences industry, enabling impactful solutions through every connection.
                            </p>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION 3: CORE VALUES */}
            <section className="relative py-24 md:py-32 bg-background overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {/* Blue Tech Grid Lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid-lines" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid-lines)" className="text-secondary" />
                    </svg>

                    {/* Fades for smooth transitions from previous sections */}
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
                </div>

                <div className="container relative z-10 mx-auto px-4 max-w-7xl">
                    <div className="text-center mb-16 md:mb-24">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Our Core Values</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
                        {/* Value 1 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms] rounded-[1.5rem] bg-background h-full flex flex-col lg:col-span-2">
                            <Shield className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Integrity</h3>
                            <p className="text-muted-foreground leading-relaxed flex-1">
                                Upholding the highest ethical standards in every interaction, fostering a culture of transparency, respect, and trust with our team and stakeholders.
                            </p>
                        </Card>
                        {/* Value 2 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms] rounded-[1.5rem] bg-background h-full flex flex-col lg:col-span-2">
                            <Users className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Our Community</h3>
                            <p className="text-muted-foreground leading-relaxed flex-1">
                                Building seamless connections and creating value for users and partners, while embracing feedback as a key driver of growth and improvement.
                            </p>
                        </Card>
                        {/* Value 3 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms] rounded-[1.5rem] bg-background h-full flex flex-col lg:col-span-2">
                            <ArrowUpCircle className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Continuous Improvement</h3>
                            <p className="text-muted-foreground leading-relaxed flex-1">
                                Encouraging learning, adaptability, and innovation to continuously enhance our platform, processes, and services.
                            </p>
                        </Card>
                        {/* Value 4 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms] rounded-[1.5rem] bg-background h-full flex flex-col md:col-span-1 lg:col-span-2 lg:col-start-2">
                            <HeartHandshake className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Stronger Together</h3>
                            <p className="text-muted-foreground leading-relaxed flex-1">
                                Creating opportunities for learning and growth in a supportive and inclusive environment where every individual is valued and empowered to contribute.
                            </p>
                        </Card>
                        {/* Value 5 */}
                        <Card className="border-foreground/10 p-8 shadow-sm hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-[400ms] rounded-[1.5rem] bg-background h-full flex flex-col md:col-span-1 lg:col-span-2 lg:col-start-4">
                            <Leaf className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold text-foreground mb-3">Sustainability</h3>
                            <p className="text-muted-foreground leading-relaxed flex-1">
                                Promoting responsible and sustainable practices, recognizing that small, consistent actions lead to meaningful long-term impact.
                            </p>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION 4: CTA */}
            <section className="py-32 md:py-48 bg-sky-50/50 border-t border-foreground/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-12 leading-[1.1]">
                        Join Us in Building the Future of Biotech Collaboration
                    </h2>
                    <Button size="lg" className="h-16 px-12 text-lg font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 rounded-full hover:scale-105" asChild>
                        <Link to="/signup">
                            Become a Partner <ArrowRight className="ml-2 w-6 h-6" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}
