const admin = require("firebase-admin");
const serviceAccount = require("./pharmasocii_admin.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkLogos() {
    const snap = await db.collection("partnersCollection").get();
    let found = [];
    snap.forEach(doc => {
        const data = doc.data();
        if (data.companyLogoUrl || data.logoUrl) {
            found.push({
                id: doc.id,
                businessName: data.businessName,
                companyLogoUrl: data.companyLogoUrl,
                logoUrl: data.logoUrl
            });
        }
    });

    console.log("Partners with logos:", JSON.stringify(found, null, 2));

    const eventsSnap = await db.collection("eventsCollection").get();
    let eventsFound = [];
    eventsSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyLogoUrl || data.logoUrl) {
            eventsFound.push({
                id: doc.id,
                eventName: data.eventName,
                companyLogoUrl: data.companyLogoUrl,
                logoUrl: data.logoUrl
            });
        }
    });
    console.log("Events with logos:", JSON.stringify(eventsFound, null, 2));

    const jobsSnap = await db.collection("jobsCollection").get();
    let jobsFound = [];
    jobsSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyLogoUrl || data.logoUrl) {
            jobsFound.push({
                id: doc.id,
                jobTitle: data.jobTitle,
                companyLogoUrl: data.companyLogoUrl,
                logoUrl: data.logoUrl
            });
        }
    });
    console.log("Jobs with logos:", JSON.stringify(jobsFound, null, 2));
}

checkLogos().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
