"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createGroup, createInvite } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiPlus, HiX, HiUserGroup, HiArrowLeft } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateGroupPage() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [inviteEmails, setInviteEmails] = useState<string[]>([]);
    const [currentEmail, setCurrentEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuth();
    const router = useRouter();

    const handleAddEmail = () => {
        if (currentEmail && !inviteEmails.includes(currentEmail)) {
            setInviteEmails([...inviteEmails, currentEmail]);
            setCurrentEmail("");
        }
    };

    const handleRemoveEmail = (email: string) => {
        setInviteEmails(inviteEmails.filter(e => e !== email));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError("");

        try {
            const groupId = await createGroup(name, description, user.uid);

            // Create invites
            if (inviteEmails.length > 0) {
                await Promise.all(inviteEmails.map(email =>
                    createInvite(groupId, email, user.uid)
                ));
            }

            router.push(`/groups/${groupId}`);
        } catch (err: any) {
            setError("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto py-10 px-4">
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
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Bring Friends</label>
                            <div className="flex gap-3">
                                <Input
                                    value={currentEmail}
                                    onChange={(e) => setCurrentEmail(e.target.value)}
                                    placeholder="friend@email.com"
                                    type="email"
                                    className="h-16 px-6 flex-1 font-medium rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all placeholder:text-gray-300 shadow-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddEmail();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    onClick={handleAddEmail}
                                    className="h-16 w-16 p-0 rounded-2xl bg-gray-900 hover:bg-teal-600 transition-colors shadow-lg shadow-gray-100 flex items-center justify-center transform active:scale-95"
                                >
                                    <HiPlus className="w-8 h-8" />
                                </Button>
                            </div>

                            <AnimatePresence>
                                {inviteEmails.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {inviteEmails.map((email, idx) => (
                                            <motion.div
                                                key={email}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-teal-100"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-[10px]">
                                                    {email.charAt(0).toUpperCase()}
                                                </div>
                                                {email}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmail(email)}
                                                    className="p-1 hover:bg-teal-100 rounded-lg transition-colors"
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
