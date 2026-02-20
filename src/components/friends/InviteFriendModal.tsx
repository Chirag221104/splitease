"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { searchUsers } from "@/lib/firestore";
import { sendFriendRequest } from "@/lib/friendsService";
import { useDebounce } from "@/hooks/useDebounce";
import { User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiX, HiSearch, HiUserAdd, HiCheckCircle } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";

interface InviteFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InviteFriendModal({ isOpen, onClose }: InviteFriendModalProps) {
    const { user: currentUser } = useAuth();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        const performSearch = async () => {
            if (debouncedSearch.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const searchResults = await searchUsers(debouncedSearch);
                // Filter out current user from results
                setResults(searchResults.filter(u => u.uid !== currentUser?.uid));
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedSearch, currentUser?.uid]);

    const handleSendRequest = async (targetUser: User) => {
        if (!currentUser) return;
        setSendingId(targetUser.uid);
        try {
            await sendFriendRequest(currentUser.uid, targetUser.uid);
            showToast("Friend request sent!", "success");
            // Optionally remove from results or mark as sent
            setResults(prev => prev.filter(u => u.uid !== targetUser.uid));
        } catch (error: any) {
            showToast(error.message || "Failed to send request", "error");
        } finally {
            setSendingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <HiUserAdd className="text-teal-600" />
                        Find Friends
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <HiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="relative">
                        <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Search by username or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 rounded-2xl border-gray-100 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-lg font-medium"
                        />
                    </div>

                    <div className="min-h-[300px] max-h-[400px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Searching users...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-3">
                                {results.map((targetUser) => (
                                    <motion.div
                                        key={targetUser.uid}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white border border-transparent hover:border-gray-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-teal-100 group-hover:scale-110 transition-transform">
                                                {targetUser.displayName?.[0] || targetUser.username?.[0] || "U"}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 italic">@{targetUser.username || "user"}</p>
                                                <p className="text-xs text-gray-500 font-medium">{targetUser.displayName || targetUser.email}</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="rounded-xl px-4 font-black shadow-teal-100/50"
                                            onClick={() => handleSendRequest(targetUser)}
                                            isLoading={sendingId === targetUser.uid}
                                        >
                                            Add Friend
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        ) : searchTerm.length >= 2 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <span className="text-5xl mb-4 grayscale opacity-50">🕶️</span>
                                <h3 className="text-lg font-black text-gray-900">No users found</h3>
                                <p className="text-gray-500 text-sm max-w-[200px] mx-auto mt-1">Try a different username or an exact email address.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                                <HiSearch className="w-12 h-12 mb-4 opacity-10" />
                                <p className="text-sm font-bold uppercase tracking-widest italic">Start typing to find friends</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
