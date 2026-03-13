"use client";

import { useState, useEffect } from "react";
import { createInvite } from "@/lib/firestore";
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
}

export function AddMemberForm({ groupId, groupName, onMemberAdded, currentMembers = [] }: AddMemberFormProps) {
    const [email, setEmail] = useState("");
    const [friends, setFriends] = useState<User[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const { user } = useAuth();

    useEffect(() => {
        const fetchFriends = async () => {
            if (!user) return;
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
    }, [user]);

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
