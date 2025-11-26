export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    username?: string;
    photoURL: string | null;
    createdAt?: number;
}

export interface Group {
    id: string;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: number;
    members: string[]; // Array of User UIDs
}

export type SplitType = 'EQUAL' | 'UNEQUAL' | 'SHARES' | 'PERCENTAGE';

export interface Split {
    userId: string;
    amount: number;
    shares?: number;
    percentage?: number;
}

export interface Expense {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    // New multi-contributor support
    contributors?: Record<string, number>; // userId -> amount contributed
    // Legacy single-payer support (for backward compatibility)
    paidBy?: string; // User UID
    date: number; // Timestamp
    splitType: SplitType;
    splits: Split[];
    createdBy: string;
    createdAt: number;
    note?: string;
}

export interface Settlement {
    id: string;
    groupId: string;
    fromUser: string;
    toUser: string;
    amount: number;
    date: number;
}

export interface Balance {
    [userId: string]: number; // Positive means they are owed, negative means they owe
}

export interface Transaction {
    from: string;
    to: string;
    amount: number;
}

export interface Invite {
    id: string;
    groupId: string;
    email: string;
    invitedUid?: string;
    invitedBy: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: number;
}

export interface Activity {
    id: string;
    type: 'expense' | 'settle' | 'invite_accepted' | 'group_created';
    groupId: string;
    userId: string;
    amount?: number;
    description: string;
    metadata?: Record<string, any>;
    createdAt: number;
}
