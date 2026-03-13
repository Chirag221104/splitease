"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFriends, getPendingRequests, respondToFriendRequest, removeFriend } from "@/lib/friendsService";
import { getPendingUserGroupInvites, acceptInvite } from "@/lib/firestore";
import { User, FriendRequest, Invite } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { InviteFriendModal } from "@/components/friends/InviteFriendModal";
import { DeleteFriendModal } from "@/components/friends/DeleteFriendModal";
import { HiUsers, HiMailOpen, HiPlus, HiOutlineTrash, HiCheck, HiX, HiCursorClick, HiArrowLeft, HiUserGroup } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";

type Tab = "friends" | "received" | "sent";

export default function FriendsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>("friends");
    const [friends, setFriends] = useState<User[]>([]);
    const [incoming, setIncoming] = useState<(FriendRequest & { userData?: User })[]>([]);
    const [groupInvites, setGroupInvites] = useState<(Invite & { groupName?: string; inviterName?: string })[]>([]);
    const [outgoing, setOutgoing] = useState<(FriendRequest & { userData?: User })[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; friendId: string | null; friendName: string }>({ isOpen: false, friendId: null, friendName: "" });
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchData = async () => {
        if (!user) return;
        try {
            const [fList, iList, oList, gInvitesRaw] = await Promise.all([
                getFriends(user.uid),
                getPendingRequests(user.uid, "incoming"),
                getPendingRequests(user.uid, "outgoing"),
                user.email ? getPendingUserGroupInvites(user.email, user.uid) : Promise.resolve([])
            ]);

            // Enrich group invites
            const enrichedInvites = await Promise.all(
                gInvitesRaw.map(async (inv) => {
                    let groupName = inv.groupName || "Unknown Circle";
                    let inviterName = inv.inviterName || "Someone";

                    try {
                        // Only fetch if missing or to refresh
                        if (!inv.groupName) {
                            const groupDoc = await getDoc(doc(db, "groups", inv.groupId));
                            if (groupDoc.exists()) groupName = groupDoc.data().name;
                        }

                        if (!inv.inviterName) {
                            const inviterDoc = await getDoc(doc(db, "users", inv.invitedBy));
                            if (inviterDoc.exists()) inviterName = inviterDoc.data().displayName || inviterDoc.data().username || "Someone";
                        }
                    } catch (err) {
                        console.warn("Could not fetch extra invite details (likely group permission):", err);
                    }

                    return { ...inv, groupName, inviterName };
                })
            );

            setFriends(fList);
            setIncoming(iList);
            setOutgoing(oList);
            setGroupInvites(enrichedInvites);
        } catch (error) {
            console.error("Error fetching friends data:", error);
        }
    };

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        fetchData().then(() => setLoading(false));

        const userSub = onSnapshot(doc(db, "users", user.uid), () => {
            fetchData();
        });

        const incomingSub = onSnapshot(
            query(
                collection(db, "friendRequests"),
                where("toId", "==", user.uid),
                where("status", "==", "pending")
            ),
            () => {
                fetchData();
            }
        );

        const outgoingSub = onSnapshot(
            query(
                collection(db, "friendRequests"),
                where("fromId", "==", user.uid),
                where("status", "==", "pending")
            ),
            () => {
                fetchData();
            }
        );

        return () => {
            userSub();
            incomingSub();
            outgoingSub();
        };
    }, [user]);

    const handleAction = async (requestId: string, action: "accepted" | "declined" | "cancelled") => {
        if (!user) return;
        setProcessingId(requestId);
        try {
            await respondToFriendRequest(requestId, user.uid, action);
            showToast(`Request ${action}`, action === "accepted" ? "success" : "info");
        } catch (error: any) {
            showToast(error.message || "Action failed", "error");
        } finally {
            fetchData();
            setProcessingId(null);
        }
    };

    const handleRemoveFriendClick = (friendId: string, name: string) => {
        setDeleteModalState({ isOpen: true, friendId, friendName: name });
    };

    const confirmRemoveFriend = async () => {
        if (!user || !deleteModalState.friendId) return;

        const friendId = deleteModalState.friendId;
        setDeleteModalState(prev => ({ ...prev, isOpen: false }));
        setProcessingId(friendId);
        try {
            await removeFriend(user.uid, friendId);
            showToast("Friend removed", "info");
            fetchData();
        } catch (error: any) {
            showToast(error.message || "Failed to remove friend", "error");
        } finally {
            setProcessingId(null);
            setDeleteModalState({ isOpen: false, friendId: null, friendName: "" });
        }
    };

    if (loading && friends.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Synchronizing connections...</p>
            </div>
        );
    }
    return (
        <div className="max-w-4xl mx-auto pt-10 pb-20 px-4">
            <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-10 transition-colors group"
            >
                <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Back to Network
            </motion.button>

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">Your <span className="text-teal-600 not-italic">Network</span></h1>
                    <p className="text-gray-500 mt-1 font-medium">Manage your inner circle and pending invites</p>
                </div>
                <Button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="rounded-2xl h-14 px-8 font-black shadow-xl shadow-teal-100/50 w-full sm:w-auto"
                >
                    <HiPlus className="w-5 h-5 mr-2" />
                    Invite Friend
                </Button>
            </header>

            {/* Premium 3-Tab Selector */}
            <div className="bg-gray-100 p-1.5 rounded-[2rem] flex flex-wrap sm:flex-nowrap items-center gap-1.5 shadow-inner">
                {[
                    { id: "friends", label: "Friends", count: friends.length, icon: HiUsers },
                    { id: "received", label: "Notifications", count: incoming.length + groupInvites.length, icon: HiMailOpen },
                    { id: "sent", label: "Sent", count: outgoing.length, icon: HiCursorClick }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 rounded-[1.75rem] font-black tracking-tight transition-all relative overflow-hidden ${activeTab === tab.id
                            ? "bg-white text-teal-600 shadow-md transform scale-[1.02]"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                            }`}
                    >
                        <tab.icon className="w-4 h-4 sm:w-5 h-5" />
                        <span className="text-xs sm:text-base">{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-600"
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <main>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === "friends" && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {friends.length > 0 ? friends.map(friend => (
                                    <div key={friend.uid} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-teal-100 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center text-xl font-black text-white group-hover:rotate-6 transition-transform shadow-lg shadow-teal-100">
                                                {(friend.displayName?.[0] || friend.username?.[0] || "U").toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 italic">@{friend.username}</h3>
                                                {friend.displayName && <p className="text-sm text-gray-500 font-medium">{friend.displayName}</p>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFriendClick(friend.uid, friend.displayName || friend.username || "Unknown")}
                                            className="p-3 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                            title="Unfriend"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
                                    </div>
                                )) : (
                                    <EmptyState icon="👋" title="Your friend list is empty" message="SplitEase is better with friends. Start by inviting someone!" />
                                )}
                            </div>
                        )}

                        {activeTab === "received" && (
                            <div className="space-y-4">
                                {incoming.length > 0 ? incoming.map(req => (
                                    <div key={req.id} className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center text-lg font-black text-white">
                                                {(req.userData?.displayName?.[0] || req.userData?.username?.[0] || "U").toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900">Incoming request from <span className="text-rose-600 italic">@{req.userData?.username}</span></p>
                                                {req.userData?.displayName && <p className="text-xs text-gray-500 font-medium">{req.userData.displayName}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleAction(req.id, "accepted")}
                                                className="h-10 px-4 bg-teal-600 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-100"
                                                disabled={processingId === req.id}
                                            >
                                                <HiCheck /> Accept
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.id, "declined")}
                                                className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors"
                                                disabled={processingId === req.id}
                                            >
                                                <HiX /> Decline
                                            </button>
                                        </div>
                                    </div>
                                )) : null}

                                {/* Group Invites */}
                                {groupInvites.length > 0 ? groupInvites.map(invite => (
                                    <div key={invite.id} className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-lg font-black text-white">
                                                <HiUserGroup className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900">Invite to join <span className="text-teal-600 italic">&quot;{invite.groupName}&quot;</span></p>
                                                <p className="text-xs text-gray-500 font-medium">Invited by {invite.inviterName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={async () => {
                                                    setProcessingId(invite.id);
                                                    try {
                                                        await acceptInvite(invite.id, user!);
                                                        showToast("You've joined the group!", "success");
                                                        fetchData();
                                                    } catch (err: any) {
                                                        showToast(err.message || "Failed to join group", "error");
                                                    } finally {
                                                        setProcessingId(null);
                                                    }
                                                }}
                                                className="h-10 px-4 bg-teal-600 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-100"
                                                disabled={processingId === invite.id}
                                            >
                                                <HiCheck /> Accept
                                            </button>
                                        </div>
                                    </div>
                                )) : null}

                                {incoming.length === 0 && groupInvites.length === 0 && (
                                    <EmptyState icon="📫" title="No new notifications" message="When people invite you to be friends or join their groups, you'll see them here." />
                                )}
                            </div>
                        )}

                        {activeTab === "sent" && (
                            <div className="space-y-4">
                                {outgoing.length > 0 ? outgoing.map(req => (
                                    <div key={req.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-lg font-black text-gray-500">
                                                {(req.userData?.displayName?.[0] || req.userData?.username?.[0] || "U").toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900">Waiting for <span className="text-teal-600 italic">@{req.userData?.username}</span></p>
                                                <p className="text-xs text-gray-500 font-medium">Request sent pending acceptance</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAction(req.id, "cancelled")}
                                            className="h-10 px-4 text-rose-500 font-black text-sm hover:bg-rose-50 rounded-xl transition-colors"
                                            disabled={processingId === req.id}
                                        >
                                            Cancel Invite
                                        </button>
                                    </div>
                                )) : (
                                    <EmptyState icon="🚀" title="No outgoing requests" message="Add people by searching for their username or email above." />
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            <InviteFriendModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
            />

            <DeleteFriendModal
                isOpen={deleteModalState.isOpen}
                onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmRemoveFriend}
                friendName={deleteModalState.friendName}
            />
        </div>
    );
}

function EmptyState({ icon, title, message }: { icon: string, title: string, message: string }) {
    return (
        <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <span className="text-6xl block mb-6">{icon}</span>
            <h3 className="text-xl font-black text-gray-900">{title}</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-2 font-medium">{message}</p>
        </div>
    );
}
