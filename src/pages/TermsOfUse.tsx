import { Link } from "react-router-dom";

export default function TermsOfUse() {
  return (
    <div className="flex-1 bg-background py-16 md:py-24 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
            Terms of Use
          </h1>
          <p className="text-lg md:text-xl text-primary font-medium">
            PharmaSocii Platform Terms of Service
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
          <div className="bg-foreground/5 p-8 md:p-12 rounded-3xl border border-foreground/10 shadow-xl backdrop-blur-sm space-y-8 text-foreground/90 text-sm md:text-base leading-relaxed">
            <p>
              Welcome to <strong>PharmaSocii</strong> (“Platform”), operated by PharmaSocii (“we, our, us”). These Terms of Service (“Terms”) govern your access to and use of the Platform.
            </p>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">1. Acceptance & Entire Agreement</h2>
              <p>
                By accessing or using the Platform (including browsing, registering, signing up, or posting), you agree to be bound by these Terms of Service, our{" "}
                <Link to="/guidelines" className="text-primary hover:underline font-medium">
                  Community Guidelines
                </Link>
                , and our{" "}
                <Link to="/privacy" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </Link>{" "}
                (collectively, the “Agreement”).
              </p>
              <p>
                The Agreement constitutes the entire agreement between you and PharmaSocii regarding your use of the Platform and supersedes any prior or contemporaneous agreements, representations, or understandings, whether written or oral. Continued use of the Platform after updates to these Terms constitutes acceptance of those updates.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">2. Eligibility & Accounts</h2>
              <p>The Platform provides two types of accounts:</p>
              <div className="pl-4 space-y-4">
                <div>
                  <h3 className="font-bold text-foreground">1. Member Accounts (Community)</h3>
                  <ul className="list-disc pl-5 space-y-1 mt-1 text-muted-foreground">
                    <li>Required to participate in the community.</li>
                    <li>Anonymous usernames are permitted.</li>
                    <li>Each individual may maintain only one Member Account, which is personal and non-transferable.</li>
                    <li>You are solely responsible for safeguarding your login credentials and all activity under your account.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">2. Partner Accounts (Marketplace)</h3>
                  <ul className="list-disc pl-5 space-y-1 mt-1 text-muted-foreground">
                    <li>Required to post business listings, services, jobs, events, or other marketplace content.</li>
                    <li>May be created by or on behalf of a company or individual professional.</li>
                    <li>If you create a Partner Account on behalf of a business, you represent that you are authorized to bind that business to this Agreement.</li>
                    <li>Partner Accounts do not replace or substitute Member Accounts; companies and individuals wishing to participate in the community must also create a Member Account.</li>
                  </ul>
                </div>
              </div>
              <p className="pt-2">
                You must be at least the <strong>age of majority</strong> in your jurisdiction to create any account. By registering, you consent to receive electronic communications from us (including notices under Section 16).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">3. User-Generated Content</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You retain ownership of any intellectual property rights in content you post.</li>
                <li>
                  By posting or submitting content, you grant PharmaSocii a <strong>worldwide, non-exclusive, royalty-free, transferable, and sublicensable license</strong> to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, publicly display, and publicly perform such content for the purposes of:
                  <ul className="list-circle pl-6 mt-1 space-y-1 text-muted-foreground">
                    <li>Operating and maintaining the Platform,</li>
                    <li>Improving and developing new features, and</li>
                    <li>Promoting and marketing PharmaSocii and the community.</li>
                  </ul>
                </li>
                <li>You are solely responsible for the content you post and for ensuring you have the necessary rights to share it.</li>
                <li>Community posts are <strong>public and permanent</strong>; while moderation or technical removals may occur, copies may persist in backups and logs.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">4. Community Guidelines</h2>
              <p>
                You agree to comply with our{" "}
                <Link to="/guidelines" className="text-primary hover:underline font-medium">
                  Community Guidelines
                </Link>
                , which are incorporated into these Terms. These Guidelines include the rules listed below as well as additional, more detailed policies published separately. We may update the detailed Guidelines from time to time, and your continued use of the Platform constitutes acceptance of those updates.
              </p>
              <p>You must not post or share content that involves:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>False, misleading, or unverifiable information about medical products, treatments, services, or research.</li>
                <li>Promotional content relating to clinical trials, medicinal products, medical devices, or other regulated offerings.</li>
                <li>Off-label promotion, solicitation of patients, or unverified medical/regulatory claims.</li>
                <li>Confidential, proprietary, or third-party information without authorization.</li>
                <li>Offensive, discriminatory, threatening, harassing, or otherwise abusive conduct.</li>
                <li>Unlawful material or content that infringes intellectual property rights.</li>
                <li>Spam, bulk messaging, or other irrelevant or repetitive promotions.</li>
                <li>Scraping, reverse-engineering, technical attacks on the Platform, or misrepresentation of identity, credentials, or qualifications.</li>
                <li>Any other content that we reasonably determine to be harmful to the community, inconsistent with the purposes of the Platform, or in violation of applicable law.</li>
              </ul>
              <h3 className="font-bold text-foreground mt-3">Reporting Violations</h3>
              <p>
                The Platform includes tools that allow any user to report content they believe is harmful, spam, or otherwise violates these Guidelines. Reports may be reviewed at our discretion, but we are not obligated to act on every report. Our moderation decisions are final and may not be appealed.
              </p>
              <p>
                Violations may result in action under Section 9 (Moderation & Enforcement) or Section 14 (Termination).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">5. Public Nature of Content</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Content posted to the community is public by design. Do not post confidential, proprietary, or personally sensitive information that you do not wish to be public.</li>
                <li>Anonymous usernames do not guarantee privacy or anonymity, particularly if you choose to share identifying details in your posts or if content is copied or distributed outside the Platform.</li>
                <li>Content may be visible to other users, external parties, and may be discoverable through third-party search engines.</li>
                <li>Deleted or removed content may continue to exist in system backups or logs for a period of time.</li>
                <li>PharmaSocii is not responsible for any misuse, copying, distribution, or re-identification attempts by other users or third parties.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">6. Marketplace & Posting Features</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>The Platform enables businesses and professionals to post jobs, services, offerings, and event listings.</li>
                <li>You are solely responsible for the legality, accuracy, and content of your listings, including compliance with all applicable laws and regulations (such as advertising, employment, data protection, and promotion of medical or life sciences products and services).</li>
                <li>PharmaSocii does not verify or guarantee any listings, does not endorse any users or businesses, and is not a party to any transaction, agreement, or arrangement between users.</li>
                <li>Fees paid for posting or subscription services relate only to hosting your listing on the Platform and do not guarantee exposure, reach, leads, or business outcomes.</li>
                <li>Any engagement, negotiation, or transaction between users is undertaken entirely at your own risk. Disputes must be resolved directly between the parties.</li>
                <li>We reserve the right (but not the obligation) to remove, suspend, or modify any posting that we reasonably believe violates these Terms, the Community Guidelines, or applicable law.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">7. Regulatory, Compliance & Life Sciences Discussions</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Discussions on regulatory, medical, legal, compliance, or <strong>any other life sciences–related topics</strong> reflect the personal opinions and experiences of users, not PharmaSocii.</li>
                <li>PharmaSocii does not monitor, verify, endorse, or guarantee the accuracy, completeness, or reliability of such content.</li>
                <li>Nothing on the Platform constitutes medical advice, legal advice, compliance guidance, or other professional advice. You should not rely on any content as a substitute for consultation with qualified professionals.</li>
                <li>You are solely responsible for evaluating and relying on information obtained through the Platform. PharmaSocii disclaims all liability for decisions made or actions taken based on such content.</li>
                <li>Content is intended for <strong>general informational and community-building purposes only</strong>.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">8. Subscriptions; Renewals; Cancellation</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Pricing & Taxes:</strong> Subscription fees are charged in U.S. dollars unless otherwise specified, and are exclusive of applicable taxes. Taxes may be applied based on your billing information and applicable law. If you provide valid tax identification or exemption information where legally recognized, taxes may not be charged. You are solely responsible for any taxes, duties, or charges that may apply.
                </li>
                <li>
                  <strong>Automatic Renewal:</strong> Subscriptions renew automatically at the end of each billing period unless cancelled before renewal.
                </li>
                <li>
                  <strong>Cancellation & Refunds:</strong> You may cancel at any time through account settings or by contacting support. Cancellation is effective at the end of the current billing period. All fees are non-refundable, including if your account is suspended or terminated.
                </li>
                <li>
                  <strong>Price Changes:</strong> We may modify subscription fees with reasonable advance notice before your next billing cycle.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">9. Moderation & Enforcement</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>We reserve the right (but not the obligation) to monitor activity and content on the Platform.</li>
                <li>We may remove, edit, or restrict access to content, or suspend or terminate accounts, if we reasonably believe they violate these Terms, the Community Guidelines, or applicable law, or if we otherwise consider such action necessary to protect the Platform or its users.</li>
                <li>Reports of harmful, spam, or otherwise prohibited content may be reviewed at our discretion. We are not obligated to act on every report.</li>
                <li>Our moderation decisions are final and may not be appealed.</li>
                <li>We are not liable for any loss, damage, or consequence arising from our moderation decisions, including removal of content, suspension of accounts, or termination of access.</li>
                <li>Our failure to act in a particular instance does not waive our right to act in the future.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">10. Disclaimer</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>The Platform and all content, features, and services are provided on an <strong>“AS IS” and “AS AVAILABLE” basis</strong>, without warranties of any kind. Access may be interrupted, suspended, or discontinued without notice.</li>
                <li>The views expressed by users are their own and do not reflect the views of PharmaSocii. We do not endorse any user content, nor do we offer medical, legal, compliance, or other professional advice through the Platform.</li>
                <li>We disclaim all warranties, express or implied, including but not limited to merchantability, fitness for a particular purpose, accuracy, availability, security, and non-infringement.</li>
                <li>We do not guarantee that the Platform or its content will always meet your requirements or expectations, or that access will be uninterrupted, timely, secure, or error-free. While we take reasonable measures to protect the Platform, we do not warrant that it will be free from defects, viruses, or harmful code.</li>
                <li>Nothing in this Disclaimer affects any <strong>non-waivable statutory rights</strong> that may apply under local law.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">11. Intellectual Property (IP) & Notices</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Our IP:</strong> The Platform and all related materials — including software, design, databases, compilations, features, functionality, trademarks, logos, and content provided by us — are the property of PharmaSocii or our licensors and are protected by intellectual property laws. Except as expressly permitted under these Terms, no license or right is granted to you in or to our IP.
                </li>
                <li>
                  <strong>User Restrictions:</strong> You may not copy, reproduce, distribute, display, or create derivative works from Platform materials, except as expressly permitted by these Terms, for personal use, or with our prior written consent.
                </li>
                <li>
                  <strong>Infringement Notices:</strong> If you believe content on the Platform infringes your intellectual property rights, you may notify us at <a href="mailto:legal@pharmasocii.com" className="text-primary hover:underline">legal@pharmasocii.com</a>. Your notice should include sufficient detail to identify the content at issue, the rights you claim, and your contact information. We may, at our discretion, remove or disable access to the identified content and may notify the user who posted it.
                </li>
                <li>
                  <strong>Repeat Infringers:</strong> Accounts of users who repeatedly post infringing content may be suspended or terminated.
                </li>
                <li>
                  <strong>No Responsibility Until Notice:</strong> We are not responsible for infringing content posted by users unless and until we receive a valid notice and have had a reasonable opportunity to act.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">12. Third-Party Services, Listings & Links</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>The Platform may contain listings, profiles, or links to third-party businesses, services, events, or resources. These are provided for informational and marketplace purposes only.</li>
                <li>All such listings and content are created by third parties, not by PharmaSocii. We do not control, endorse, or assume responsibility for the accuracy, legality, or reliability of third-party content, products, or services.</li>
                <li>Accessing third-party sites or engaging with third-party businesses is at your own risk. We disclaim all liability arising from such interactions, including for loss, damage, or disputes that result from reliance on or dealings with third parties.</li>
                <li>Any contracts, transactions, or arrangements made through or as a result of the Platform are strictly between you and the third party. PharmaSocii is not a party to those arrangements and has no obligations or liability in connection with them.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">13. Limitation of Liability</h2>
              <p>To the maximum extent permitted by applicable law:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Exclusions:</strong> PharmaSocii shall not be liable for any indirect, incidental, consequential, special, or exemplary damages, including without limitation lost profits, lost opportunities, reputational harm, data loss, or business interruption, even if advised of the possibility of such damages.
                </li>
                <li>
                  <strong>Aggregate Cap:</strong> PharmaSocii's total liability for any claims arising out of or relating to the Platform shall not exceed CAD $100, regardless of the form of action or number of claims.
                </li>
                <li>
                  <strong>Community-Only Use:</strong> If you use the Platform solely for free community access without paying fees, you acknowledge that PharmaSocii shall have no liability to you.
                </li>
                <li>
                  <strong>Scope:</strong> These limitations apply to all legal theories of liability (including contract, tort, negligence, equity, and statutory claims), except to the extent such limitations are prohibited by applicable law.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">14. Termination, Suspension & Effect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Our Rights:</strong> PharmaSocii may suspend or terminate your access to the Platform at any time, including if we reasonably believe you have violated these Terms, applicable law, or engaged in conduct that may harm the Platform, other users, or PharmaSocii. We will provide notice where reasonable, but immediate suspension may occur if necessary to protect the Platform or its users.
                </li>
                <li>
                  <strong>Effect of Termination:</strong> Upon termination, your right to access and use the Platform will cease immediately. PharmaSocii may, but is not obligated to, retain or remove any User Content you submitted.
                </li>
                <li>
                  <strong>Survival:</strong> Licenses you granted to PharmaSocii will continue with respect to copies already made or used in connection with the Platform. Any sections of these Terms which by their nature should survive termination (including Intellectual Property, Limitation of Liability, Indemnity, and Dispute Resolution) shall remain in effect.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">15. User Content and Responsibility</h2>
              <p>
                Users are solely responsible for the information, listings, communications, and other materials (“User Content”) they make available through the Platform. You represent and warrant that you own or have the necessary rights to such User Content and that it does not violate any law or third-party rights. PharmaSocii does not endorse, verify, or control User Content and disclaims any liability for it. We may remove or restrict access to User Content that we reasonably believe violates these Terms, our Community Guidelines, or applicable law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">16. Indemnity</h2>
              <p>
                To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless PharmaSocii, its affiliates, and their respective officers, directors, employees, contractors, and agents from and against any and all claims, demands, damages, losses, liabilities, costs, and expenses (including reasonable legal fees and court costs) arising out of or related to:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                <li>Your Content: Any information, listings, materials, or communications you submit, post, or make available through the Platform;</li>
                <li>Your Use of the Platform: Any activity conducted under your account, whether or not authorized by you;</li>
                <li>Violations: Your breach of these Terms, our Community Guidelines, or any applicable law, regulation, or third-party rights; and</li>
                <li>User Disputes: Any dispute, interaction, or transaction between you and another user or third party arising from or related to your use of the Platform.</li>
              </ol>
              <p>
                PharmaSocii reserves the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to fully cooperate with such defense. You agree not to settle any such matter without PharmaSocii’s prior written consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">17. Contact for Privacy & Legal Notices</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Contact:</strong> <a href="mailto:legal@pharmasocii.com" className="text-primary hover:underline">legal@pharmasocii.com</a></li>
                <li><strong>Primary Method:</strong> Email is the primary method for privacy and legal notices.</li>
                <li><strong>Acknowledgment:</strong> Notices sent to this address will be deemed received when we acknowledge them by reply. If no acknowledgment is sent, notices will nevertheless be deemed received thirty (30) days after delivery to the above address.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">18. Force Majeure</h2>
              <p>
                PharmaSocii shall not be liable or responsible for any delay or failure in performance resulting from events beyond its reasonable control, including but not limited to acts of God, natural disasters, epidemics or pandemics, labor disputes, power or internet failures, cyberattacks, government actions, or other events of similar nature. During such events, PharmaSocii’s obligations will be suspended for the duration of the event and will resume once performance is reasonably possible.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">19. Governing Law & Dispute Resolution</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Governing Law:</strong> These Terms shall be governed by and construed in accordance with the laws of the Province of Ontario and the applicable federal laws of Canada, without regard to conflict-of-law principles.
                </li>
                <li>
                  <strong>Mediation First:</strong> The parties shall attempt in good faith to resolve any dispute, controversy, or claim arising out of or relating to these Terms through confidential mediation in Ontario, Canada. Mediation should begin within a reasonable period (typically 30–60 days) after notice of dispute.
                </li>
                <li>
                  <strong>Arbitration:</strong> If the dispute is not resolved through mediation, it shall be finally resolved by binding arbitration under Ontario’s <em>Arbitration Act, 1991</em>. The seat of arbitration shall be Ontario, Canada, the proceedings shall be conducted in English, and the arbitrator’s decision shall be final and binding.
                </li>
                <li>
                  <strong>Court Relief Exception:</strong> Notwithstanding the foregoing, either party may seek temporary or injunctive relief in a court of competent jurisdiction where necessary to protect intellectual property or confidential information.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">20. Notices</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Delivery:</strong> PharmaSocii may provide notices to you by email, through in-Platform notifications, or by posting updates on the Platform.
                </li>
                <li>
                  <strong>Responsibility:</strong> You are responsible for keeping your account contact details accurate and current.
                </li>
                <li>
                  <strong>Deemed Receipt:</strong> Notices sent by email shall be deemed received on the date sent, and notices provided through the Platform shall be deemed received on the date they are made available to you.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">21. Changes to Terms</h2>
              <p>
                PharmaSocii may update these Terms at any time. Updated Terms are effective upon posting to the Platform. Your continued use of the Platform after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">22. Contact Information</h2>
              <p>
                For general inquiries, please contact: <a href="mailto:info@pharmasocii.com" className="text-primary hover:underline">info@pharmasocii.com</a>
                <br />
                For privacy and legal notices, please use: <a href="mailto:legal@pharmasocii.com" className="text-primary hover:underline">legal@pharmasocii.com</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
