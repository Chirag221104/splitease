"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createGroup, createInvite } from "@/lib/firestore";
import { getFriends } from "@/lib/friendsService";
import { User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiPlus, HiX, HiUserGroup, HiArrowLeft, HiSearch, HiUser } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateGroupPage() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [inviteUsers, setInviteUsers] = useState<User[]>([]);
    const [friends, setFriends] = useState<User[]>([]);
    const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentSearch, setCurrentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const fetchFriends = async () => {
            if (user) {
                const friendList = await getFriends(user.uid);
                setFriends(friendList);
            }
        };
        fetchFriends();
    }, [user]);

    useEffect(() => {
        if (currentSearch.trim().length > 0) {
            const search = currentSearch.toLowerCase();
            const filtered = friends.filter(f =>
                (f.username?.toLowerCase().includes(search) ||
                    f.email?.toLowerCase().includes(search) ||
                    f.displayName?.toLowerCase().includes(search)) &&
                !inviteUsers.some(iu => iu.uid === f.uid)
            );
            setFilteredFriends(filtered);
            setShowDropdown(true);
        } else {
            setFilteredFriends([]);
            setShowDropdown(false);
        }
    }, [currentSearch, friends, inviteUsers]);

    const handleAddUser = (targetUser: User) => {
        if (!inviteUsers.find(u => u.uid === targetUser.uid)) {
            setInviteUsers([...inviteUsers, targetUser]);
            setCurrentSearch("");
            setShowDropdown(false);
        }
    };

    const handleRemoveUser = (uid: string) => {
        setInviteUsers(inviteUsers.filter(u => u.uid !== uid));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError("");

        try {
            const groupId = await createGroup(name, description, user.uid);

            // Create invites
            if (inviteUsers.length > 0) {
                await Promise.all(inviteUsers.map(invitedUser => {
                    const identifier = invitedUser.email || invitedUser.username || invitedUser.uid;
                    return createInvite(groupId, identifier, user.uid);
                }));
            }

            router.push(`/groups/${groupId}`);
        } catch (err: any) {
            setError("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto pt-10 pb-20 px-4">
            <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-8 transition-colors group"
            >
                <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Return to groups
            </motion.button>

            <motion.header
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
            >
                <div className="w-16 h-16 bg-teal-50 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-teal-50">
                    <HiUserGroup className="w-8 h-8 text-teal-600" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">
                    Start a <span className="text-teal-600 not-italic">New Circle</span>
                </h1>
                <p className="text-gray-500 font-medium mt-2 max-w-sm">Bring your friends together and start sharing expenses seamlessly.</p>
            </motion.header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl shadow-gray-100 border border-gray-50 relative overflow-hidden"
            >
                {/* Accent background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full opacity-20 -mr-10 -mt-10"></div>

                <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">The Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., European Summer '24"
                                className="h-16 px-6 text-lg font-bold rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all placeholder:text-gray-300 shadow-sm"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Short Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this circle for?"
                                className="h-16 px-6 font-medium rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all placeholder:text-gray-300 shadow-sm"
                            />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Bring Friends</label>
                                <p className="text-[10px] text-gray-400 mt-1 ml-1 italic font-medium">Find and add friends to your new circle</p>
                            </div>

                            <div className="relative group/invite">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/invite:text-teal-500 transition-colors z-10">
                                    <HiSearch className="w-6 h-6" />
                                </div>
                                <Input
                                    value={currentSearch}
                                    onChange={(e) => setCurrentSearch(e.target.value)}
                                    placeholder="Friend's name or username..."
                                    className="h-16 pl-16 pr-6 w-full font-medium rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all placeholder:text-gray-300 shadow-sm"
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                />

                                {/* Dropdown */}
                                <AnimatePresence>
                                    {showDropdown && filteredFriends.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-50 overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar"
                                        >
                                            {filteredFriends.map((f) => (
                                                <button
                                                    key={f.uid}
                                                    type="button"
                                                    onClick={() => handleAddUser(f)}
                                                    className="w-full flex items-center gap-4 p-4 hover:bg-teal-50 transition-colors text-left group/item"
                                                >
                                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover/item:bg-teal-600 group-hover/item:text-white transition-all font-black">
                                                        {f.displayName?.charAt(0) || f.username?.charAt(0) || <HiUser />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 leading-tight">{f.displayName || f.username}</p>
                                                        <p className="text-[10px] text-gray-500 font-medium">@{f.username}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <AnimatePresence>
                                {inviteUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {inviteUsers.map((invitedUser) => (
                                            <motion.div
                                                key={invitedUser.uid}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-teal-100 group/chip"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-[10px] shadow-sm">
                                                    {(invitedUser.displayName || invitedUser.username || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>{invitedUser.displayName || invitedUser.username}</span>
                                                    <span className="text-[8px] opacity-70">@{invitedUser.username}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUser(invitedUser.uid)}
                                                    className="p-1 hover:bg-teal-100 rounded-lg transition-colors ml-1"
                                                >
                                                    <HiX className="w-4 h-4" />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {error && (
                        <p className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-3 rounded-xl border border-rose-100">{error}</p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button
                            type="submit"
                            isLoading={loading}
                            className="flex-1 py-8 rounded-2xl text-lg font-black tracking-wider uppercase shadow-xl shadow-teal-100 hover:shadow-2xl transition-all"
                        >
                            Create Group
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                            className="py-8 px-10 rounded-2xl text-gray-400 font-bold hover:bg-gray-50 transition-all uppercase tracking-widest text-[10px]"
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
