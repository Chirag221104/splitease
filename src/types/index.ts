export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    username?: string;
    photoURL: string | null;
    friends?: string[]; // Array of User UIDs for fast querying
    createdAt?: number;
    notificationSettings?: {
        expenseAdded: boolean;
        groupInvite: boolean;
        settlementReceived: boolean;
    };
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
    isDeleted?: boolean; // Soft delete for ledger integrity
    currentVersion?: number;
}

export interface ExpenseVersion {
    id: string;
    expenseId: string;
    version: number;
    snapshot: Omit<Expense, "id" | "currentVersion">;
    updatedBy: string;
    updatedAt: number;
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
    groupName?: string;
    email: string;
    invitedUid?: string;
    invitedBy: string;
    inviterName?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: number;
}

export interface Activity {
    id: string;
    type: 'expense' | 'settle' | 'invite_accepted' | 'group_created' | 'expense_edited' | 'expense_deleted' | 'friend_request_sent' | 'friend_request_accepted' | 'friend_request_declined' | 'friendship_removed' | 'friendship_reactivated' | 'member_removed';
    groupId: string;
    userId: string;
    amount?: number;
    description: string;
    metadata?: Record<string, any>;
    createdAt: number;
}

export interface ExpenseWithGroup extends Expense {
    groupName: string;
}

export interface FriendRequest {
    id: string;
    fromId: string;
    toId: string;
    status: 'pending' | 'accepted' | 'declined' | 'cancelled';
    createdAt: number;
}

export interface Friendship {
    id: string;
    user1: string;
    user2: string;
    isActive: boolean; // Soft delete/reactivation
    createdAt: number;
    updatedAt?: number;
}
