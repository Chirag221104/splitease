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
    runTransaction,
    documentId
} from "firebase/firestore";
import { db } from "./firebase";
import { FriendRequest, Friendship, User } from "@/types";
import { validateUserEmail, getUserByUsername } from "./firestore";
import { logActivity, ActivityTypes } from "./activityService";

export const sendFriendRequest = async (fromId: string, emailOrUsernameOrId: string) => {
    let toUser;

    // Check if it's already a UID (approximate check: no @ and 28 chars)
    if (emailOrUsernameOrId.length === 28 && !emailOrUsernameOrId.includes('@')) {
        const userDoc = await getDoc(doc(db, "users", emailOrUsernameOrId));
        if (userDoc.exists()) {
            toUser = { uid: userDoc.id, ...userDoc.data() } as User;
        }
    }

    if (!toUser) {
        if (emailOrUsernameOrId.includes('@')) {
            toUser = await validateUserEmail(emailOrUsernameOrId);
        } else {
            toUser = await getUserByUsername(emailOrUsernameOrId);
        }
    }

    if (!toUser) throw new Error("User not found");
    if (toUser.uid === fromId) throw new Error("You cannot send a friend request to yourself.");

    // Check if already friends
    const fromUserDoc = await getDoc(doc(db, "users", fromId));
    const fromUserData = fromUserDoc.data() as User;
    if (fromUserData.friends?.includes(toUser.uid)) {
        throw new Error("You are already friends with this user.");
    }

    // Check for existing pending requests in both directions
    const q1 = query(
        collection(db, "friendRequests"),
        where("fromId", "==", fromId),
        where("toId", "==", toUser.uid),
        where("status", "==", "pending")
    );
    const q2 = query(
        collection(db, "friendRequests"),
        where("fromId", "==", toUser.uid),
        where("toId", "==", fromId),
        where("status", "==", "pending")
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    if (!snap1.empty) throw new Error("A pending request already exists.");

    // Auto-accept if they already sent a request to you
    if (!snap2.empty) {
        return respondToFriendRequest(snap2.docs[0].id, fromId, "accepted");
    }

    const requestRef = await addDoc(collection(db, "friendRequests"), {
        fromId,
        toId: toUser.uid,
        status: "pending",
        createdAt: serverTimestamp()
    });

    await logActivity({
        type: ActivityTypes.FRIEND_REQUEST_SENT,
        groupId: "global",
        userId: fromId,
        description: `sent a friend request to ${toUser.displayName || toUser.email || toUser.uid}`,
        metadata: { toId: toUser.uid, requestId: requestRef.id }
    });

    return requestRef.id;
};

/**
 * Responds to a friend request (Accept/Decline).
 * Uses a transaction to ensure friendship and user arrays stay perfectly synced.
 */
export const respondToFriendRequest = async (
    requestId: string,
    userId: string,
    action: "accepted" | "declined" | "cancelled"
) => {
    return await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "friendRequests", requestId);
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) throw new Error("Friend request not found.");
        const request = requestSnap.data() as FriendRequest;

        if (request.status !== "pending") throw new Error("Request already processed.");

        // Security check
        if (action === "accepted" || action === "declined") {
            if (request.toId !== userId) throw new Error("Unauthorized.");
        } else if (action === "cancelled") {
            if (request.fromId !== userId) throw new Error("Unauthorized.");
        }

        if (action === "declined" || action === "cancelled") {
            transaction.update(requestRef, { status: action });
            return { status: action };
        }

        // --- Action: Accepted ---

        // 1. Double-check idempotency: are they already friends?
        const fromUserRef = doc(db, "users", request.fromId);
        const toUserRef = doc(db, "users", request.toId);

        const [fromSnap, toSnap] = await Promise.all([
            transaction.get(fromUserRef),
            transaction.get(toUserRef)
        ]);

        const fromData = fromSnap.data() as User;
        const toData = toSnap.data() as User;

        if (fromData.friends?.includes(request.toId)) {
            transaction.update(requestRef, { status: "accepted" });
            return { status: "already_friends" };
        }

        // 2. Look for an existing soft-deleted friendship to reactivate
        const friendshipsRef = collection(db, "friendships");
        const existingQ = query(
            friendshipsRef,
            where("userA", "in", [request.fromId, request.toId]),
            where("userB", "in", [request.fromId, request.toId])
        );
        // Note: Transactions don't support queries directly in some cases, but we can fetch it before or use a deterministic ID.
        // For simplicity and correctness, we use a deterministic ID: sort UIDs to create a unique friendship ID.
        const sortedIds = [request.fromId, request.toId].sort();
        const friendshipId = `${sortedIds[0]}_${sortedIds[1]}`;
        const friendshipRef = doc(db, "friendships", friendshipId);
        const friendshipSnap = await transaction.get(friendshipRef);

        if (friendshipSnap.exists()) {
            const fs = friendshipSnap.data() as Friendship;
            if (fs.isActive) {
                // Should not happen due to previous check, but safeguard.
                transaction.update(requestRef, { status: "accepted" });
                return { status: "already_friends" };
            }
            // Reactivate
            transaction.update(friendshipRef, { isActive: true, updatedAt: serverTimestamp() });
            await logActivity({
                type: ActivityTypes.FRIENDSHIP_REACTIVATED,
                groupId: "global",
                userId: userId,
                description: "reactivated a previously removed friendship",
                metadata: { friendId: request.fromId === userId ? request.toId : request.fromId }
            });
        } else {
            // Create new
            transaction.set(friendshipRef, {
                id: friendshipId,
                userA: sortedIds[0],
                userB: sortedIds[1],
                isActive: true,
                createdAt: serverTimestamp()
            });
            await logActivity({
                type: ActivityTypes.FRIEND_REQUEST_ACCEPTED,
                groupId: "global",
                userId: userId,
                description: "is now friends with you",
                metadata: { friendId: request.fromId === userId ? request.toId : request.fromId }
            });
        }

        // 3. Update User arrays
        transaction.update(fromUserRef, { friends: arrayUnion(request.toId) });
        transaction.update(toUserRef, { friends: arrayUnion(request.fromId) });

        // 4. Update request status
        transaction.update(requestRef, { status: "accepted" });

        return { status: "success" };
    });
};

/**
 * Removes a friend (Soft Delete).
 */
export const removeFriend = async (userId: string, friendId: string) => {
    return await runTransaction(db, async (transaction) => {
        const sortedIds = [userId, friendId].sort();
        const friendshipId = `${sortedIds[0]}_${sortedIds[1]}`;
        const friendshipRef = doc(db, "friendships", friendshipId);

        transaction.update(friendshipRef, { isActive: false, updatedAt: serverTimestamp() });

        transaction.update(doc(db, "users", userId), { friends: arrayRemove(friendId) });
        transaction.update(doc(db, "users", friendId), { friends: arrayRemove(userId) });

        await logActivity({
            type: ActivityTypes.FRIENDSHIP_REMOVED,
            groupId: "global",
            userId: userId,
            description: "removed a friend",
            metadata: { friendId }
        });
    });
};

/**
 * Fetches the user profiles for all friends of a user.
 * Handles the Firestore "in" query limit by chunking.
 */
export const getFriends = async (userId: string) => {
    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.data() as User;
    const friendsIds = userData.friends || [];

    if (friendsIds.length === 0) return [];

    const chunks = [];
    for (let i = 0; i < friendsIds.length; i += 10) {
        chunks.push(friendsIds.slice(i, i + 10));
    }

    const friends: User[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, "users"), where("uid", "in", chunk));
        const snap = await getDocs(q);
        friends.push(...snap.docs.map(d => d.data() as User));
    }

    return friends;
};

/**
 * Fetches pending requests for a user.
 */
export const getPendingRequests = async (userId: string, direction: "incoming" | "outgoing") => {
    const q = query(
        collection(db, "friendRequests"),
        where(direction === "incoming" ? "toId" : "fromId", "==", userId),
        where("status", "==", "pending")
    );
    const snap = await getDocs(q);

    // We also need user details for the other side of the request
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest & { userData?: User }));

    const otherIds = requests.map(r => direction === "incoming" ? r.fromId : r.toId);
    if (otherIds.length > 0) {
        // Simple helper to fetch profiles (could be batched if many)
        for (const req of requests) {
            const otherId = direction === "incoming" ? req.fromId : req.toId;
            const otherDoc = await getDoc(doc(db, "users", otherId));
            req.userData = otherDoc.data() as User;
        }
    }

    return requests;
};
