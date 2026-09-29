import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type AuditLogAction =
    | "ACCOUNT_CREATED"
    | "ACCOUNT_UPDATED"
    | "PASSWORD_UPDATED"
    | "LISTING_CREATED"
    | "LISTING_UPDATED"
    | "LISTING_DELETED"
    | "CATEGORY_DELETED"
    | "PAYMENT_SUCCESS"
    | "PAYMENT_FAILED"
    | "FEATURE_ADDED"
    | "SUBSCRIPTION_CANCELLED"
    | "ADMIN_ACTION"
    | "MEMBER_REGISTERED"
    | "MEMBER_LOGIN"
    | "MEMBER_UPDATED"
    | "MEMBER_STATUS_CHANGED"
    | "MEMBER_DELETED"
    | "POST_CREATED"
    | "POST_EDITED"
    | "POST_DELETED"
    | "POST_ARCHIVED"
    | "POST_RESTORED"
    | "COMMENT_POSTED"
    | "COMMENT_REPORTED"
    | "COMMENT_ACTIVATED"
    | "COMMENT_DEACTIVATED";

export interface AuditLogData {
    partnerId: string;
    partnerName: string;
    action: AuditLogAction;
    details: string;
    category: "account" | "billing" | "listing" | "admin" | "community";
    performedBy?: "admin" | "partner" | "member" | "system";
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

export interface MemberAuditLogData {
    memberId: string;
    memberName: string;
    action: AuditLogAction;
    details: string;
    category?: "community" | "account" | "admin";
    performedBy?: "admin" | "member" | "system";
    metadata?: any;
}

export const logMemberActivity = async (data: MemberAuditLogData) => {
    try {
        await addDoc(collection(db, "auditLogs"), {
            partnerId: data.memberId,
            partnerName: data.memberName,
            action: data.action,
            details: data.details,
            category: data.category || "community",
            performedBy: data.performedBy || "member",
            metadata: {
                ...data.metadata,
                role: "member",
                scope: data.metadata?.scope || "community_members",
            },
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to log member activity:", error);
    }
};
