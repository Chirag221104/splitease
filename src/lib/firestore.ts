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
    documentId,
    runTransaction
} from "firebase/firestore";
import { db } from "./firebase";
import { User, Group, Expense, Settlement, Transaction, Invite, Activity, ExpenseWithGroup } from "@/types";
import { logActivity, ActivityTypes } from "./activityService";

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
    try {
        const q = query(collection(db, "groups"), where("members", "array-contains", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
    } catch (error) {
        console.error("Error in getUserGroups for userId:", userId, error);
        throw error;
    }
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
        currentVersion: 1,
        isDeleted: false,
        createdAt: serverTimestamp()
    });

    const userId = expense.contributors
        ? Object.keys(expense.contributors)[0]
        : expense.paidBy || expense.createdBy;

    await logActivity({
        type: ActivityTypes.EXPENSE_CREATED,
        groupId: expense.groupId,
        userId: userId,
        amount: expense.amount,
        description: `added "${expense.description}"`,
        metadata: { expenseId: expenseRef.id }
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

export const updateExpense = async (expenseId: string, expense: Partial<Omit<Expense, "id" | "createdAt">>, updatedBy: string) => {
    return await runTransaction(db, async (transaction) => {
        const docRef = doc(db, "expenses", expenseId);
        const snap = await transaction.get(docRef);
        if (!snap.exists()) throw new Error("Expense not found");

        const oldData = snap.data() as Expense;
        const newVersion = (oldData.currentVersion || 1) + 1;

        // 1. Store snapshot of current data as a version
        const historyRef = doc(collection(docRef, "versions"));
        transaction.set(historyRef, {
            expenseId,
            version: oldData.currentVersion || 1,
            snapshot: { ...oldData },
            updatedBy,
            updatedAt: serverTimestamp()
        });

        // 2. Update the main document
        transaction.update(docRef, {
            ...expense,
            currentVersion: newVersion,
            updatedAt: serverTimestamp()
        });

        // 3. Log Activity
        await logActivity({
            type: ActivityTypes.EXPENSE_EDITED,
            groupId: oldData.groupId,
            userId: updatedBy,
            amount: expense.amount || oldData.amount,
            description: `updated "${expense.description || oldData.description}"`,
            metadata: {
                expenseId,
                version: newVersion
            }
        });
    });
};

export const getGroupExpenses = async (groupId: string) => {
    try {
        const q = query(
            collection(db, "expenses"),
            where("groupId", "==", groupId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Expense))
            .filter(e => e.isDeleted !== true);
    } catch (error) {
        console.error("Error in getGroupExpenses for groupId:", groupId, error);
        throw error;
    }
};

export const deleteExpense = async (expenseId: string, userId: string) => {
    const docRef = doc(db, "expenses", expenseId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Expense not found");
    const data = snap.data() as Expense;

    const groupDoc = await getDoc(doc(db, "groups", data.groupId));
    const groupData = groupDoc.exists() ? groupDoc.data() : null;

    // Check if user is the creator or the group admin
    const isCreator = data.createdBy === userId;
    const isGroupAdmin = groupData?.createdBy === userId;

    if (!isCreator && !isGroupAdmin) {
        throw new Error("Only the expense creator or group admin can delete this expense");
    }

    await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: serverTimestamp()
    });

    await logActivity({
        type: ActivityTypes.EXPENSE_DELETED,
        groupId: data.groupId,
        userId: userId,
        amount: data.amount,
        description: `deleted "${data.description}"`,
        metadata: { expenseId }
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
    try {
        const q = query(
            collection(db, "settlements"),
            where("groupId", "==", groupId),
            orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
    } catch (error) {
        console.error("Error in getGroupSettlements for groupId:", groupId, error);
        throw error;
    }
};

export const getUserActivity = async (userId: string) => {
    try {
        // Get user's groups first
        const userGroups = await getUserGroups(userId);
        const groupIds = userGroups.map(g => g.id);

        if (groupIds.length === 0) return [];

        // Fetch recent activities from these groups
        const q = query(
            collection(db, "activities"),
            where("groupId", "in", groupIds.slice(0, 10)),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    } catch (error) {
        console.error("Error in getUserActivity for userId:", userId, error);
        throw error;
    }
};

// Users
export const getUsersByIds = async (uids: string[]) => {
    const validUids = uids.filter(uid => uid && typeof uid === 'string' && uid.trim() !== "");
    if (validUids.length === 0) return [];

    const chunks = [];
    for (let i = 0; i < validUids.length; i += 10) {
        chunks.push(validUids.slice(i, i + 10));
    }

    const users = [];
    for (const chunk of chunks) {
        try {
            const q = query(collection(db, "users"), where(documentId(), "in", chunk));
            const snapshot = await getDocs(q);
            users.push(...snapshot.docs.map(doc => doc.data() as User));
        } catch (error) {
            console.error("Error in getUsersByIds chunk:", chunk, error);
        }
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

// Users - Search
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    searchTerm = searchTerm.toLowerCase();

    // We try to search by username first
    const usernameQ = query(
        collection(db, "users"),
        where("username", ">=", searchTerm),
        where("username", "<=", searchTerm + "\uf8ff")
    );

    const emailQ = query(
        collection(db, "users"),
        where("email", "==", searchTerm)
    );

    const [uSnap, eSnap] = await Promise.all([getDocs(usernameQ), getDocs(emailQ)]);

    const results: User[] = [];
    const seenUids = new Set<string>();

    [...uSnap.docs, ...eSnap.docs].forEach(doc => {
        const data = doc.data() as User;
        if (!seenUids.has(data.uid)) {
            results.push(data);
            seenUids.add(data.uid);
        }
    });

    return results;
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

        // Map expenses with group name, filtering out deleted ones in memory
        const expensesWithGroup = expensesSnapshot.docs
            .map(expenseDoc => ({
                id: expenseDoc.id,
                ...expenseDoc.data(),
                groupName
            } as ExpenseWithGroup))
            .filter(e => e.isDeleted !== true);

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

