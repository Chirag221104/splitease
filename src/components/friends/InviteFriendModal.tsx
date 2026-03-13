"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sendFriendRequest } from "@/lib/friendsService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiX, HiSearch, HiUserAdd } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";

interface InviteFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InviteFriendModal({ isOpen, onClose }: InviteFriendModalProps) {
    const { user: currentUser } = useAuth();
    const { showToast } = useToast();
    const [identifier, setIdentifier] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !identifier.trim()) return;

        setLoading(true);
        try {
            await sendFriendRequest(currentUser.uid, identifier.trim());
            showToast("Friend request sent!", "success");
            setIdentifier("");
            onClose();
        } catch (error: any) {
            showToast(error.message || "Failed to send request", "error");
        } finally {
            setLoading(false);
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
                        Invite Friend
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <HiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSendRequest} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-gray-500">
                            Enter the exact username or email address of the person you want to add.
                        </p>
                        <div className="relative">
                            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Username or email..."
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="pl-12 h-14 rounded-2xl border-gray-100 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-lg font-medium"
                                autoFocus
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-teal-100/50"
                        isLoading={loading}
                        disabled={!identifier.trim()}
                    >
                        Send Friend Request
                    </Button>

                    <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100/50">
                        <p className="text-xs text-teal-800 font-bold leading-relaxed">
                            <span className="opacity-50">Note:</span> They will see your request in their Notifications tab once sent.
                        </p>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
