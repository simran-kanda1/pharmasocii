import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="flex-1 bg-background py-16 md:py-24 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
            Privacy Policy
          </h1>
          <p className="text-lg md:text-xl text-primary font-medium">
            Effective Date: July 17, 2026
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
          <div className="bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm space-y-8 text-foreground/90 text-sm md:text-base leading-relaxed">
            <p>
              <strong>PharmaSocii</strong> (“we,” “our,” “us”) respects your privacy. This Privacy Policy explains how we collect, use, share, and protect your information when you use our Platform.
            </p>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2>
              <p>We may collect the following information when you use PharmaSocii:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li><strong>Account Information:</strong> Username, email address, and password.</li>
                <li><strong>User-Generated Content:</strong> Posts, comments, discussions, and other contributions you make on the Platform.</li>
                <li><strong>Profile & Marketplace Information:</strong> Organizational details, service categories, countries of operation, and marketplace-related fields that describe your offerings.</li>
                <li><strong>Marketplace Representatives (Optional):</strong> Contact details or identifiers you choose to provide to represent your organization.</li>
                <li><strong>Technical & Usage Information:</strong> Device data, IP address, browser type, operating system, and cookies or similar tracking data.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li><strong>Operate and Improve the Platform:</strong> Provide, maintain, and enhance features and functionality.</li>
                <li><strong>Manage Accounts and Community Features:</strong> Enable participation in discussions and marketplace visibility.</li>
                <li><strong>Ensure Appropriate Use:</strong> Enforce our{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms of Use
                  </Link>{" "}
                  and{" "}
                  <Link to="/guidelines" className="text-primary hover:underline">
                    Community Guidelines
                  </Link>
                  , and help protect against misuse, spam, or technical abuse. We do not actively monitor all content.</li>
                <li><strong>Provide Support:</strong> Respond to inquiries and troubleshoot issues.</li>
                <li><strong>Analytics and Insights:</strong> Create aggregated, anonymized reports to improve services.</li>
                <li><strong>Legal and Compliance:</strong> Meet applicable legal and regulatory obligations.</li>
              </ul>
              <p className="pt-1">We do not sell your personal information.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">3. Legal Basis for Processing Personal Data</h2>
              <p>We rely on different legal bases depending on the context:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>Consent:</strong> For optional information you choose to provide.</li>
                <li><strong>Contract:</strong> To provide you with access to the Platform.</li>
                <li><strong>Legitimate Interests:</strong> To operate, maintain, and improve the Platform, balanced against your rights.</li>
                <li><strong>Legal Obligations:</strong> To comply with applicable laws or valid legal requests.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">4. Sharing of Information</h2>
              <p>We do not sell or trade your personal information. We may share it only in these cases:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li><strong>Service Providers:</strong> With trusted vendors who provide hosting, analytics, security, or other business services under strict confidentiality obligations.</li>
                <li><strong>Legal & Compliance:</strong> Where required by law, regulation, or valid legal request.</li>
                <li><strong>Business Transfers:</strong> If PharmaSocii is involved in a merger, acquisition, or sale of assets.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">5. International Data Transfers</h2>
              <p>
                Your information may be transferred to, stored on, or processed in countries outside your own, including where data protection laws may differ. We take steps to safeguard such transfers, including through reputable cloud hosting providers and appropriate legal mechanisms where required. By using the Platform, you consent to these transfers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">6. Data Retention</h2>
              <p>
                We retain account, profile, listing, and community content as long as necessary to operate the Platform and maintain its integrity. Certain information may be kept for historical accuracy or legal obligations.
              </p>
              <p>
                Backups and system logs may persist for an extended period but are subject to reasonable safeguards. Deletion requests will be honored where required by law and technically feasible.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">7. Your Choices & Rights</h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>Access the information we hold about you.</li>
                <li>Correct or update inaccuracies.</li>
                <li>Request deletion of your data.</li>
                <li>Restrict or object to certain processing.</li>
                <li>Withdraw consent for optional data.</li>
                <li>Receive a copy of your data in portable format.</li>
              </ul>
              <p className="pt-2">
                To exercise these rights, contact us at <a href="mailto:info@pharmasocii.com" className="text-primary hover:underline">info@pharmasocii.com</a>. We may require identity verification before processing your request.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">8. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar technologies to improve your experience and ensure smooth operation.
              </p>
              <p className="font-semibold text-foreground">Cookies help us with:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>Authentication:</strong> Keep you logged in.</li>
                <li><strong>Preferences:</strong> Remember settings (e.g., language, categories).</li>
                <li><strong>Performance and Analytics:</strong> Understand usage and improve the Platform.</li>
              </ul>
              <p>
                We use tools such as Google Analytics to collect anonymized data. We do not use cookies for advertising, and we do not sell or share cookie data for marketing.
              </p>
              <p>
                When you visit our site, you may be presented with options to manage your cookie preferences, including the ability to accept or reject non-essential cookies. Essential cookies cannot be disabled. You can also manage cookies through your browser settings, though some features may not function properly without them.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">9. Public Content</h2>
              <p>
                Content you post (such as comments or marketplace listings) is publicly visible. Do not share personal, confidential, or sensitive information in public posts. Even if you delete your account, some content may remain visible as part of discussions or platform records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">10. Children</h2>
              <p>
                The Platform is not directed to individuals under the age of majority in their place of residence. You must not create an account or use the Platform if you are under this age. We do not knowingly collect personal information from children. If we learn that such information has been collected, we will take reasonable steps to delete it.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">11. Data Security</h2>
              <p>
                We implement reasonable administrative, technical, and organizational measures to protect your information. This includes using reputable cloud hosting providers with industry-standard safeguards.
              </p>
              <p>
                However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">12. Third-Party Websites and Services</h2>
              <p>
                The Platform may contain links to third-party websites or provide options to interact with third-party services (for example, LinkedIn sharing or marketplace listings). These third parties have their own privacy policies, which we do not control.
              </p>
              <p>
                We are not responsible for their practices and encourage you to review their privacy policies before providing personal information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">13. Governing Law</h2>
              <p>
                This Privacy Policy, and any disputes arising out of or in connection with it, are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein.
              </p>
              <p>
                Any such disputes will be resolved in accordance with the dispute resolution process in our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Use
                </Link>
                .
              </p>
              <p>
                If you access the Platform from outside Canada, you do so at your own initiative and are responsible for complying with local laws where applicable.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
