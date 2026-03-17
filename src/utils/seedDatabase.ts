import { db } from "@/firebase";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";

export const seedTesterData = async () => {
    try {
        const dummyPartners = [
            {
                partnerId: "dummy-user-1",
                businessName: "BioTech Innovations LLC",
                primaryName: "Alice Smith",
                primaryEmail: "alice@biotechinnovations.test",
                phoneNumber: "+1 (555) 123-4567",
                businessAddress: "123 Innovation Drive, Boston, MA",
                selectedGroup: "business_offerings",
                selectedPlan: "premium_mo",
                partnerStatus: "Approved",
                companyProfileText: "We specialize in advanced cell therapies.",
                isFeatured: true, // Dummy active feature payment flag
                createdAt: serverTimestamp(),
            },
            {
                partnerId: "dummy-user-2",
                businessName: "Global Pharma Consulting",
                primaryName: "Bob Johnson",
                primaryEmail: "bob@globalpharmaconsulting.test",
                phoneNumber: "+1 (555) 987-6543",
                businessAddress: "456 Consulting Way, New York, NY",
                selectedGroup: "consulting",
                selectedPlan: "standard_yr",
                partnerStatus: "Approved",
                companyProfileText: "Expert guidance on regulatory affairs.",
                isFeatured: true, // Dummy active feature payment flag
                createdAt: serverTimestamp(),
            }
        ];

        for (const partner of dummyPartners) {
            const pRef = doc(db, "partnersCollection", partner.partnerId);
            await setDoc(pRef, partner);

            // Add a mock business offering for the first one
            if (partner.partnerId === "dummy-user-1") {
                const offerRef = doc(collection(pRef, "businessOfferingsCollection"));
                await setDoc(offerRef, {
                    planId: "premium_mo",
                    bioSafetyLevel: ["BSL-2"],
                    serviceRegions: ["North America", "Europe"],
                    certifications: ["ISO 9001", "GMP"],
                    serviceCountries: ["USA", "Germany", "UK"],
                    categories: ["Cell & Gene Therapy", "Clinical Research"],
                    createdAt: serverTimestamp(),
                    isFeatured: true // Indicates explicitly paid for feature spotlight
                });
            }
        }

        // Seed some root level jobs
        const jobs = [
            {
                jobTitle: "Senior Bioinformatics Scientist",
                industry: "Data Science",
                country: "United States",
                experienceLevel: "Senior",
                positionLink: "https://example.com/apply",
                jobSummary: "Lead our computational biology efforts.",
                jobtype: "Full-Time",
                city: "Boston",
                state: "MA",
                workModel: "Hybrid",
                partnerId: "dummy-user-1",
                businessName: "BioTech Innovations LLC",
                isFeatured: true, // For homepage spotlight
                active: true,
                createdAt: serverTimestamp()
            },
            {
                jobTitle: "Clinical Trial Manager",
                industry: "Clinical Research",
                country: "United States",
                experienceLevel: "Mid-Level",
                positionLink: "https://example.com/apply2",
                jobSummary: "Manage multi-site Phase III oncology trials.",
                jobtype: "Full-Time",
                city: "New York",
                state: "NY",
                workModel: "Remote",
                partnerId: "dummy-user-2",
                businessName: "Global Pharma Consulting",
                isFeatured: false,
                active: true,
                createdAt: serverTimestamp()
            }
        ];

        for (const job of jobs) {
            await setDoc(doc(collection(db, "jobsCollection")), job);
        }

        // Seed some root level events
        const events = [
            {
                eventName: "Global Biotech Summit '26",
                eventLink: "https://example.com/event",
                startDate: "2026-10-14",
                location: "Moscone Center",
                city: "San Francisco",
                state: "CA",
                country: "United States",
                categories: ["Conference", "Networking", "Life Sciences"],
                isFeatured: true,
                active: true,
                partnerId: "dummy-user-1",
                createdAt: serverTimestamp()
            },
            {
                eventName: "Regulatory Affairs Symposium",
                eventLink: "https://example.com/event2",
                startDate: "2026-11-05",
                location: "Virtual",
                city: "Online",
                state: "",
                country: "Global",
                categories: ["Webinar", "Regulatory Focus"],
                isFeatured: false,
                active: true,
                partnerId: "dummy-user-2",
                createdAt: serverTimestamp()
            }
        ];

        for (const evt of events) {
            await setDoc(doc(collection(db, "eventsCollection")), evt);
        }
        alert("Tester data successfully injected into Firebase! Refresh the Admin Dashboard.");
    } catch (err: any) {
        console.error("Seeding failed", err);
        alert("Failed to seed database: " + err.message);
    }
};
