import { User } from "@/types";

export const getDisplayName = (user: User | undefined, fallback: string = "Unknown User"): string => {
    if (!user) return fallback;
    if (user.username) return user.username;
    if (user.displayName) return user.displayName;
    if (user.email) return user.email;
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
