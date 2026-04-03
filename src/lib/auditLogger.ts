import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type AuditLogAction =
    | "ACCOUNT_CREATED"
    | "ACCOUNT_UPDATED"
    | "LISTING_CREATED"
    | "LISTING_UPDATED"
    | "PAYMENT_SUCCESS"
    | "PAYMENT_FAILED"
    | "FEATURE_ADDED"
    | "SUBSCRIPTION_CANCELLED"
    | "ADMIN_ACTION";

export interface AuditLogData {
    partnerId: string;
    partnerName: string;
    action: AuditLogAction;
    details: string;
    category: "account" | "billing" | "listing" | "admin";
    metadata?: any;
}

export const logActivity = async (data: AuditLogData) => {
    try {
        await addDoc(collection(db, "auditLogs"), {
            ...data,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};
