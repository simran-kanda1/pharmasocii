import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function CommunityGuidelines() {
  const [customText, setCustomText] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "sitePolicies"));
        if (snap.exists() && snap.data().communityGuidelines) {
          setCustomText(snap.data().communityGuidelines);
        }
      } catch (err) {
        console.error("Error loading Community Guidelines policy:", err);
      }
    };
    fetchPolicy();
  }, []);
  return (
    <div className="flex-1 bg-background py-16 md:py-24 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
            Community Guidelines
          </h1>
          <p className="text-lg md:text-xl text-primary font-medium">
            Fostering a professional, safe, and collaborative space
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
          <div className="bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm space-y-8 text-foreground/90 text-sm md:text-base leading-relaxed">
            {customText ? (
              <div className="whitespace-pre-wrap space-y-4" dangerouslySetInnerHTML={{ __html: customText }} />
            ) : (
              <>
                <p>
                  <strong>PharmaSocii</strong> is a professional community designed to foster collaboration, knowledge-sharing, and problem-solving across the life sciences ecosystem. This is <strong>not</strong> a forum for marketing, recruitment, or product promotion. By participating, you agree to follow these guidelines to ensure a safe, respectful, and productive environment for all members.
                </p>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">1. Professional Conduct</h2>
              <p>
                Maintain respectful and professional behavior at all times. Diverse perspectives are welcome, but harassment, hate speech, discriminatory remarks, threats, or abusive conduct will not be tolerated.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">2. Sharing Resources & Expertise</h2>
              <p>
                Members are encouraged to share resources, tools, publications, insights, interpretations, or expertise that may help others in the community. Contributions should be relevant, constructive, and shared in good faith. Avoid speculation or misleading claims. Share to add value, including but not limited to pointing to references, recommended practices, or useful organizations. However, such discussions are informational only and should not replace professional compliance guidance specific to your situation.
              </p>
            </section>

            <section className="space-y-3 pl-4 border-l-2 border-primary/30">
              <h3 className="text-lg font-bold text-foreground">2a. No Medical or Legal Advice</h3>
              <p>
                Do not provide medical or legal advice on this Platform. Content should never be used as a substitute for consultation with a qualified physician, lawyer, or other licensed professional.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">3. Intellectual Property, Confidentiality & Unlawful Material</h2>
              <p>
                Do not post confidential, proprietary, or intellectual property belonging to yourself, your employer, or any third party. Unlawful material, or content that infringes copyrights, trademarks, or trade secrets, is strictly prohibited.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">4. Accuracy & Evidence</h2>
              <p>
                Do not share false, misleading, or unverifiable information. Accuracy and evidence-based communication are essential for maintaining trust in the community.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">5. No Promotions</h2>
              <p>
                This is not a platform for marketing or recruitment. You may not post advertisements, solicitations, or promotional content of any kind, including referrals to clinical trials, medicinal products, medical devices, therapies, or other regulated offerings — even if authorized or approved. Spam, bulk messaging, repetitive promotions, or irrelevant content are strictly prohibited.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">6. Privacy Protection</h2>
              <p>
                Respect personal and business privacy. Do not share personal data, patient information, or sensitive business details. Protect your own privacy and that of others.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">7. Technical Misuse & Misrepresentation</h2>
              <p>
                Do not attempt to scrape, harvest, reverse-engineer, or attack the Platform in any way. Do not misrepresent your identity, credentials, qualifications, or affiliations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">8. Moderation Rights</h2>
              <p>
                PharmaSocii may, at its <strong>sole discretion</strong>, review and remove any content, and suspend or terminate accounts that violate these Guidelines or the{" "}
                <Link to="/terms" className="text-primary hover:underline font-medium">
                  Terms of Use
                </Link>
                . This includes any content we reasonably determine to be harmful, inconsistent with the purposes of the Platform, or in violation of applicable law. Repeat or serious breaches may lead to permanent removal.
              </p>
              <p className="font-semibold text-foreground mt-4">You may not post content that includes, but is not limited to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>False or misleading information about medical products, treatments, or services.</li>
                <li>Promotional content regarding any topic including but not limited to clinical trials, medicinal products, devices, or similar regulated offerings.</li>
                <li>Confidential, proprietary, or third-party information without proper authorization.</li>
                <li>Offensive, discriminatory, threatening, or harassing material.</li>
                <li>Unlawful content or material that infringes on intellectual property rights.</li>
                <li>Spam, bulk messaging, or irrelevant commercial promotions.</li>
                <li>Off-label promotion, solicitation of patients, or unverified medical/regulatory claims.</li>
              </ul>
              <p className="mt-4">
                Content posted in the community cannot be edited or deleted by users once published. Even if content is removed from public view by PharmaSocii, copies may remain in system backups, logs, or archives for an <em>undefined period of time</em>.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">9. Reporting Violations</h2>
              <p>
                The Platform provides tools to report harmful, spam, or inappropriate content. Reports will be reviewed at our discretion, but we are not obligated to take action on every report. Moderation decisions are final and may not be appealed.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">10. Disclaimer</h2>
              <p>
                The views expressed by users are their own. PharmaSocii does not endorse, verify, or guarantee the accuracy, reliability, or completeness of user-submitted content. Discussions are for informational and community-building purposes only and do not constitute medical, legal, or regulatory advice.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">11. Anonymity Reminder</h2>
              <p>
                Accounts are anonymous by default, but anonymity is not absolute. Share responsibly and avoid posting anything you would not want publicly associated with you.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">12. Responsibility</h2>
              <p>
                You are responsible for the information and materials you share in the PharmaSocii community. Please ensure your posts are accurate, respectful, and lawful. Content that violates these Guidelines or our Terms of Use may be removed, and repeat violations may result in account suspension.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">13. Content Persistence</h2>
              <p>
                Deleting your account does not automatically erase all of your contributions. Some information may remain visible or stored in backups even if your account is removed.
              </p>
            </section>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
