import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    orderBy,
    onSnapshot,
    documentId
} from "firebase/firestore";
import { db } from "./firebase";
import { Group, Expense, Settlement, Invite, User, Activity, ExpenseWithGroup } from "@/types";

// Groups
export const createGroup = async (name: string, description: string, createdBy: string) => {
    const groupRef = await addDoc(collection(db, "groups"), {
        name,
        description,
        createdBy,
        createdAt: serverTimestamp(),
        members: [createdBy]
    });

    // Add group to user's profile
    await updateDoc(doc(db, "users", createdBy), {
        groups: arrayUnion(groupRef.id)
    });

    // Log activity
    await addDoc(collection(db, "activities"), {
        type: "group_created",
        groupId: groupRef.id,
        userId: createdBy,
        description: `created group "${name}"`,
        createdAt: serverTimestamp()
    });

    return groupRef.id;
};

export const getUserGroups = async (userId: string) => {
    const q = query(collection(db, "groups"), where("members", "array-contains", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
};

export const getGroupDetails = async (groupId: string) => {
    const docRef = doc(db, "groups", groupId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Group;
    }
    return null;
};

export const deleteGroup = async (groupId: string, userId: string) => {
    // Get group details to verify ownership and get member list
    const groupDoc = await getDoc(doc(db, "groups", groupId));
    if (!groupDoc.exists()) {
        throw new Error("Group not found");
    }

    const groupData = groupDoc.data();
    if (groupData.createdBy !== userId) {
        throw new Error("Only the group owner can delete this group");
    }

    // Delete all expenses associated with this group
    const expensesQuery = query(collection(db, "expenses"), where("groupId", "==", groupId));
    const expensesSnapshot = await getDocs(expensesQuery);
    const expenseDeletePromises = expensesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(expenseDeletePromises);

    // Delete all settlements associated with this group
    const settlementsQuery = query(collection(db, "settlements"), where("groupId", "==", groupId));
    const settlementsSnapshot = await getDocs(settlementsQuery);
    const settlementDeletePromises = settlementsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(settlementDeletePromises);

    // Delete all activities associated with this group
    const activitiesQuery = query(collection(db, "activities"), where("groupId", "==", groupId));
    const activitiesSnapshot = await getDocs(activitiesQuery);
    const activityDeletePromises = activitiesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(activityDeletePromises);

    // Delete all invites associated with this group
    const invitesQuery = query(collection(db, "invites"), where("groupId", "==", groupId));
    const invitesSnapshot = await getDocs(invitesQuery);
    const inviteDeletePromises = invitesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(inviteDeletePromises);

    // Remove group from all members' groups arrays
    const memberUpdatePromises = groupData.members.map((memberId: string) =>
        updateDoc(doc(db, "users", memberId), {
            groups: arrayRemove(groupId)
        })
    );
    await Promise.all(memberUpdatePromises);

    // Finally, delete the group document
    await deleteDoc(doc(db, "groups", groupId));
};

// Expenses
export const addExpense = async (expense: Omit<Expense, "id" | "createdAt">) => {
    const expenseRef = await addDoc(collection(db, "expenses"), {
        ...expense,
        createdAt: serverTimestamp()
    });

    // Log activity - handle both contributors and legacy paidBy
    const userId = expense.contributors
        ? Object.keys(expense.contributors)[0] // Use first contributor for activity
        : expense.paidBy || expense.createdBy;

    await addDoc(collection(db, "activities"), {
        type: "expense",
        groupId: expense.groupId,
        userId: userId,
        amount: expense.amount,
        description: `added "${expense.description}"`,
        createdAt: serverTimestamp()
    });

    return expenseRef.id;
};

export const getExpense = async (expenseId: string) => {
    const docRef = doc(db, "expenses", expenseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Expense;
    }
    return null;
};

export const updateExpense = async (expenseId: string, expense: Partial<Omit<Expense, "id" | "createdAt">>) => {
    const docRef = doc(db, "expenses", expenseId);
    await updateDoc(docRef, expense);

    // Fetch the updated expense to get details for activity log
    const updatedDoc = await getDoc(docRef);
    if (updatedDoc.exists()) {
        const data = updatedDoc.data() as Expense;
        // Log activity
        await addDoc(collection(db, "activities"), {
            type: "expense",
            groupId: data.groupId,
            userId: data.paidBy, // Or the user who updated it if we tracked that
            amount: data.amount,
            description: `updated "${data.description}"`,
            createdAt: serverTimestamp()
        });
    }
};

export const getGroupExpenses = async (groupId: string) => {
    const q = query(
        collection(db, "expenses"),
        where("groupId", "==", groupId),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

export const deleteExpense = async (expenseId: string, userId: string) => {
    // Get expense details first
    const expenseDoc = await getDoc(doc(db, "expenses", expenseId));
    if (!expenseDoc.exists()) {
        throw new Error("Expense not found");
    }

    const expenseData = expenseDoc.data() as Expense;

    // Get group details to verify ownership
    const groupDoc = await getDoc(doc(db, "groups", expenseData.groupId));
    if (!groupDoc.exists()) {
        throw new Error("Group not found");
    }

    const groupData = groupDoc.data();
    if (groupData.createdBy !== userId) {
        throw new Error("Only the group owner can delete expenses");
    }

    // Delete the expense
    await deleteDoc(doc(db, "expenses", expenseId));

    // Log activity
    await addDoc(collection(db, "activities"), {
        type: "expense_deleted",
        groupId: expenseData.groupId,
        userId: userId,
        amount: expenseData.amount,
        description: `deleted "${expenseData.description}"`,
        createdAt: serverTimestamp()
    });
};

// Settlements
export const recordSettlement = async (settlement: Omit<Settlement, "id">) => {
    const settlementRef = await addDoc(collection(db, "settlements"), {
        ...settlement,
        date: serverTimestamp() // Use server timestamp for consistency
    });

    // Log activity
    await addDoc(collection(db, "activities"), {
        type: "settle",
        groupId: settlement.groupId,
        userId: settlement.fromUser,
        amount: settlement.amount,
        description: `settled up ₹${settlement.amount.toFixed(2)}`,
        metadata: { toUser: settlement.toUser },
        createdAt: serverTimestamp()
    });

    return settlementRef.id;
};

export const getGroupSettlements = async (groupId: string) => {
    const q = query(
        collection(db, "settlements"),
        where("groupId", "==", groupId),
        orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
};

export const getUserActivity = async (userId: string) => {
    // Get user's groups first
    const userGroups = await getUserGroups(userId);
    const groupIds = userGroups.map(g => g.id);

    if (groupIds.length === 0) return [];

    // Fetch recent activities from these groups
    const q = query(
        collection(db, "activities"),
        where("groupId", "in", groupIds.slice(0, 10)),
        orderBy("createdAt", "desc")
        // limit(10) // Limit not supported with 'in' query in some client SDK versions without composite index, but usually fine.
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
};

// Users
export const getUsersByIds = async (uids: string[]) => {
    if (uids.length === 0) return [];
    // Firestore 'in' query is limited to 10 items.
    // We'll chunk the requests if needed, but for now assuming < 10 for simplicity or just fetch individually if > 10.
    // A better approach for many users is to fetch them all or use a different strategy.
    // For this demo, we will just fetch them all using documentId().

    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) {
        chunks.push(uids.slice(i, i + 10));
    }

    const users = [];
    for (const chunk of chunks) {
        const q = query(collection(db, "users"), where(documentId(), "in", chunk));
        const snapshot = await getDocs(q);
        users.push(...snapshot.docs.map(doc => doc.data() as User));
    }
    return users;
};

// Username Management
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
};

export const updateUserUsername = async (uid: string, username: string): Promise<void> => {
    const { validateUsername } = await import("@/lib/utils");
    const validation = validateUsername(username);

    if (!validation.valid) {
        throw new Error(validation.error || "Invalid username");
    }

    const available = await checkUsernameAvailability(username);
    if (!available) {
        throw new Error("This username is already taken");
    }

    await updateDoc(doc(db, "users", uid), {
        username: username.toLowerCase()
    });
};

export const getUserByUsername = async (username: string): Promise<{ uid: string; email: string; displayName: string | null } | null> => {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    return {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || null
    };
};

// Users - Validation
export const validateUserEmail = async (email: string): Promise<{ uid: string; email: string; displayName: string | null } | null> => {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    return {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || null
    };
};

// Invites
export const createInvite = async (groupId: string, emailOrUsername: string, invitedBy: string) => {
    let userData;

    // Determine if input is email or username
    if (emailOrUsername.includes('@')) {
        // It's an email
        userData = await validateUserEmail(emailOrUsername);
        if (!userData) {
            throw new Error("This user is not registered on SplitEase.");
        }
    } else {
        // It's a username
        userData = await getUserByUsername(emailOrUsername);
        if (!userData) {
            throw new Error("No user found with that username");
        }
    }

    const inviteRef = await addDoc(collection(db, "invites"), {
        groupId,
        email: userData.email,
        invitedUid: userData.uid,
        invitedBy,
        status: 'pending',
        createdAt: serverTimestamp()
    });
    return inviteRef.id;
};

export const getInvite = async (inviteId: string) => {
    const docRef = doc(db, "invites", inviteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Invite;
    }
    return null;
};

export const acceptInvite = async (inviteId: string, user: User) => {
    const invite = await getInvite(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== 'pending') throw new Error("Invite already processed");

    // Verify that the logged-in user matches the invited user
    if (invite.invitedUid && invite.invitedUid !== user.uid) {
        throw new Error("This invite is not for you. Please log in with the correct account.");
    }

    // Add user to group
    await updateDoc(doc(db, "groups", invite.groupId), {
        members: arrayUnion(user.uid)
    });

    // Add group to user
    await updateDoc(doc(db, "users", user.uid), {
        groups: arrayUnion(invite.groupId)
    });

    // Update invite status
    await updateDoc(doc(db, "invites", inviteId), {
        status: 'accepted'
    });

    // Log activity
    const userName = user.displayName || user.email || "Someone";
    await addDoc(collection(db, "activities"), {
        type: "invite_accepted",
        groupId: invite.groupId,
        userId: user.uid,
        description: `${userName} joined the group`,
        createdAt: serverTimestamp()
    });
};

export const getGroupInvites = async (groupId: string) => {
    const q = query(
        collection(db, "invites"),
        where("groupId", "==", groupId),
        where("status", "==", "pending")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite));
};

// Member Management
export const removeMember = async (groupId: string, memberUid: string, requestingUserId: string) => {
    // Get group details
    const group = await getGroupDetails(groupId);
    if (!group) throw new Error("Group not found");

    // Only the group creator can remove members
    if (group.createdBy !== requestingUserId) {
        throw new Error("Only the group owner can remove members");
    }

    // Cannot remove the owner
    if (memberUid === group.createdBy) {
        throw new Error("Cannot remove the group owner");
    }

    // Remove member from group
    const updatedMembers = group.members.filter(uid => uid !== memberUid);
    await updateDoc(doc(db, "groups", groupId), {
        members: updatedMembers
    });

    // Remove group from user's groups
    const userRef = doc(db, "users", memberUid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedUserGroups = (userData.groups || []).filter((gid: string) => gid !== groupId);
        await updateDoc(userRef, {
            groups: updatedUserGroups
        });
    }

    // Log activity
    await addDoc(collection(db, "activities"), {
        type: "member_removed",
        groupId,
        userId: requestingUserId,
        description: `removed a member from the group`,
        metadata: { removedUserId: memberUid },
        createdAt: serverTimestamp()
    });
};

// Activities
export const createActivity = async (activity: Omit<Activity, "id" | "createdAt">) => {
    const activityRef = await addDoc(collection(db, "activities"), {
        ...activity,
        createdAt: serverTimestamp()
    });
    return activityRef.id;
};

export const getGroupActivities = async (groupId: string, limit: number = 20) => {
    const q = query(
        collection(db, "activities"),
        where("groupId", "==", groupId),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
};

export const getUserActivities = async (userId: string, limit: number = 20) => {
    // Get user's groups first
    const userGroups = await getUserGroups(userId);
    const groupIds = userGroups.map(g => g.id);

    if (groupIds.length === 0) return [];

    // Fetch activities from these groups
    const q = query(
        collection(db, "activities"),
        where("groupId", "in", groupIds.slice(0, 10)),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
};

// Global Expense Feed
export const getAllExpensesForUser = async (userId: string): Promise<ExpenseWithGroup[]> => {
    // Get user's groups first
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    const groupIds = userData.groups || [];

    if (groupIds.length === 0) return [];

    // Fetch expenses and group details for each group
    const allExpenses: ExpenseWithGroup[] = [];

    for (const groupId of groupIds) {
        // Fetch expenses for this group
        const expensesQuery = query(
            collection(db, "expenses"),
            where("groupId", "==", groupId)
        );
        const expensesSnapshot = await getDocs(expensesQuery);

        // Fetch group details to get the group name
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        const groupName = groupDoc.exists() ? groupDoc.data().name : "Unknown Group";

        // Map expenses with group name
        const expensesWithGroup = expensesSnapshot.docs.map(expenseDoc => ({
            id: expenseDoc.id,
            ...expenseDoc.data(),
            groupName
        } as ExpenseWithGroup));

        allExpenses.push(...expensesWithGroup);
    }

    // Sort by createdAt descending
    allExpenses.sort((a, b) => {
        const aTime = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt as any)?.seconds * 1000 || 0;
        const bTime = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt as any)?.seconds * 1000 || 0;
        return bTime - aTime;
    });

    return allExpenses;
};

// Phone Number Management for OTP Reset
export const getUserByPhone = async (phone: string): Promise<{ uid: string; email: string; displayName: string | null } | null> => {
    const q = query(collection(db, "users"), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    return {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || null
    };
};

export const updateUserPhone = async (uid: string, phone: string): Promise<void> => {
    await updateDoc(doc(db, "users", uid), {
        phone: phone
    });
};

