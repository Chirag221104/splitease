"use client";

import { useState, useEffect } from "react";
import { createInvite, createOfflineMember } from "@/lib/firestore";
import { getFriends } from "@/lib/friendsService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types";
import { HiPlus, HiCheck, HiUsers } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface AddMemberFormProps {
    groupId: string;
    groupName?: string;
    onMemberAdded: () => void;
    currentMembers?: string[];
    parentMembers?: User[]; // If provided, only show these and add directly
    isGroupCreator?: boolean;
}

export function AddMemberForm({ groupId, groupName, onMemberAdded, currentMembers = [], parentMembers, isGroupCreator }: AddMemberFormProps) {
    const [email, setEmail] = useState("");
    const [friends, setFriends] = useState<User[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showOfflineForm, setShowOfflineForm] = useState(false);
    const [offlineName, setOfflineName] = useState("");
    const [offlineLoading, setOfflineLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const fetchFriends = async () => {
            if (!user || parentMembers) return; // Don't fetch friends if it's a subgroup restricted view
            setLoadingFriends(true);
            try {
                const f = await getFriends(user.uid);
                setFriends(f);
            } catch (err) {
                console.error("Error fetching friends:", err);
            } finally {
                setLoadingFriends(false);
            }
        };
        fetchFriends();
    }, [user, parentMembers]);

    // Direct add for subgroups
    const handleDirectAdd = async (targetUser: User) => {
        if (!user) return;
        setInvitingFriendId(targetUser.uid);
        setError("");
        setSuccess("");
        try {
            const { addMember } = await import("@/lib/firestore");
            await addMember(groupId, targetUser.uid, user.uid);
            setSuccess(`${targetUser.displayName || targetUser.username} added to sub-activity!`);
            onMemberAdded();
        } catch (err: any) {
            setError(err.message || "Failed to add member.");
        } finally {
            setInvitingFriendId(null);
        }
    };

    const invitePerson = async (targetEmail: string, friendId?: string) => {
        if (!user) return;
        if (friendId) setInvitingFriendId(friendId);
        else setLoading(true);

        setError("");
        setSuccess("");

        try {
            await createInvite(groupId, targetEmail, user.uid, groupName, user.displayName || user.username);
            setSuccess(`Invite sent to ${targetEmail}`);
            setEmail("");
            onMemberAdded();
        } catch (err: any) {
            setError(err.message || "Failed to send invite.");
        } finally {
            setLoading(false);
            setInvitingFriendId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        invitePerson(email);
    };

    const handleOfflineSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setOfflineLoading(true);
        setError("");
        setSuccess("");
        try {
            await createOfflineMember(groupId, user.uid, {
                name: offlineName
            });
            setSuccess(`Offline member ${offlineName} created and added to group!`);
            setOfflineName("");
            setShowOfflineForm(false);
            onMemberAdded();
        } catch (err: any) {
            setError(err.message || "Failed to create offline member.");
        } finally {
            setOfflineLoading(false);
        }
    };

    // If it's a subgroup, we only show parent members and they are added directly
    if (parentMembers) {
        const availableParentMembers = parentMembers.filter(m => !currentMembers.includes(m.uid));

        return (
            <div className="space-y-6">
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <HiUsers className="w-3 h-3" /> Add from Parent Group
                    </p>
                    {availableParentMembers.length === 0 ? (
                        <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-100">
                            All parent members are already in this sub-activity.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {availableParentMembers.map((m) => (
                                <button
                                    key={m.uid}
                                    type="button"
                                    disabled={invitingFriendId === m.uid}
                                    onClick={() => handleDirectAdd(m)}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 hover:border-teal-500 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-black text-xs group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                        {invitingFriendId === m.uid ? (
                                            <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            (m.displayName?.[0] || m.username?.[0] || "U").toUpperCase()
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-700 truncate flex-1">
                                        {m.displayName || m.username}
                                    </span>
                                    <HiPlus className="w-3 h-3 text-gray-300 group-hover:text-teal-600" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                            {error}
                        </motion.p>
                    )}
                    {success && (
                        <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-teal-600 bg-teal-50 p-3 rounded-xl border border-teal-100 italic">
                            ✨ {success}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {friends.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <HiUsers className="w-3 h-3" /> Quick Invite Friends
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                        {friends.map((friend) => {
                            const isAlreadyIn = currentMembers.includes(friend.uid);
                            const isInviting = invitingFriendId === friend.uid;

                            return (
                                <button
                                    key={friend.uid}
                                    type="button"
                                    disabled={isAlreadyIn || isInviting}
                                    onClick={() => invitePerson(friend.email || friend.username || "", friend.uid)}
                                    className={`flex flex-col items-center gap-2 min-w-[70px] transition-all group ${isAlreadyIn ? 'opacity-40 cursor-default' : 'hover:scale-105 active:scale-95'}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all relative ${isAlreadyIn ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white shadow-sm'}`}>
                                        {(friend.displayName?.[0] || friend.username?.[0] || "U").toUpperCase()}
                                        {isInviting && (
                                            <div className="absolute inset-0 bg-teal-600/20 rounded-2xl flex items-center justify-center">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                        {isAlreadyIn && (
                                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                                                <HiCheck className="w-2.5 h-2.5 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 truncate w-full text-center">
                                        {friend.displayName?.split(' ')[0] || friend.username}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Invite by Email or Username
                </p>
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. alex@example.com"
                        required
                        className="flex-1 rounded-2xl h-11 border-gray-100 focus:ring-teal-500"
                    />
                    <Button type="submit" isLoading={loading} className="rounded-xl h-11 px-6 font-black shadow-md shadow-teal-50">
                        Invite
                    </Button>
                </form>
            </div>

            {isGroupCreator && (
                <div className="pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => setShowOfflineForm(!showOfflineForm)}
                        className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                    >
                        {showOfflineForm ? "− Cancel Offline Member" : "+ Add Offline Member (Without Account)"}
                    </button>
                    
                    <AnimatePresence>
                        {showOfflineForm && (
                            <motion.form 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }} 
                                exit={{ opacity: 0, height: 0 }} 
                                onSubmit={handleOfflineSubmit} 
                                className="space-y-3 mt-4 overflow-hidden p-1 -mx-1"
                            >
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={offlineName}
                                        onChange={(e) => setOfflineName(e.target.value)}
                                        placeholder="Full Name"
                                        required
                                        className="flex-1 rounded-2xl h-11 border-gray-100 focus:ring-teal-500"
                                    />
                                    <Button type="submit" isLoading={offlineLoading} className="rounded-xl h-11 px-6 font-black shadow-md shadow-teal-50">
                                        Create
                                    </Button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <AnimatePresence>
                {error && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                        {error}
                    </motion.p>
                )}
                {success && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-teal-600 bg-teal-50 p-3 rounded-xl border border-teal-100 italic">
                        ✨ {success}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}
