import { User } from "@/types";

export const getDisplayName = (user: User | undefined, fallback: string = "Unknown User"): string => {
    if (!user) return fallback;
    if (user.displayName) return user.displayName;
    if (user.username) return user.username;
    if (user.email) return user.email.split('@')[0];
    return fallback;
};

export const validateUsername = (username: string): { valid: boolean; error?: string } => {
    // Must be lowercase, alphanumeric with _ or .
    if (!username) {
        return { valid: false, error: "Username is required" };
    }

    if (username.length < 3) {
        return { valid: false, error: "Username must be at least 3 characters" };
    }

    if (username.length > 20) {
        return { valid: false, error: "Username must be 20 characters or less" };
    }

    if (username !== username.toLowerCase()) {
        return { valid: false, error: "Username must be lowercase" };
    }

    const validPattern = /^[a-z0-9_.]+$/;
    if (!validPattern.test(username)) {
        return { valid: false, error: "Username can only contain lowercase letters, numbers, underscore, and period" };
    }

    return { valid: true };
};

export const normalizeDate = (dateVal: any): Date => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'number') return new Date(dateVal);
    if (typeof (dateVal as any).toDate === 'function') return (dateVal as any).toDate();
    // Handle Firestore timestamp-like objects that aren't instances but have seconds
    if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);

    const date = new Date(dateVal);
    return isNaN(date.getTime()) ? new Date() : date;
};
