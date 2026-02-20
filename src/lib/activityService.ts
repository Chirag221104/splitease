import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Activity } from "@/types";

/**
 * Centeralized service for immutable audit logging.
 * All significant financial and social actions should be logged here.
 */
export const logActivity = async (activity: Omit<Activity, "id" | "createdAt">) => {
    try {
        const activityRef = await addDoc(collection(db, "activities"), {
            ...activity,
            createdAt: serverTimestamp()
        });
        return activityRef.id;
    } catch (error) {
        console.error("Critical: Failed to log activity", activity, error);
        // We log to console as a fallback, but in production this might trigger an alert system.
        return null;
    }
};

export const ActivityTypes = {
    EXPENSE_CREATED: "expense",
    EXPENSE_EDITED: "expense_edited",
    EXPENSE_DELETED: "expense_deleted",
    SETTLEMENT_RECORDED: "settle",
    FRIEND_REQUEST_SENT: "friend_request_sent",
    FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",
    FRIEND_REQUEST_DECLINED: "friend_request_declined",
    FRIENDSHIP_REMOVED: "friendship_removed",
    FRIENDSHIP_REACTIVATED: "friendship_reactivated",
    GROUP_CREATED: "group_created",
    INVITE_ACCEPTED: "invite_accepted"
} as const;
