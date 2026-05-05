"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiX, HiUserGroup, HiCheck, HiSearch } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface CreateSubgroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentMembers: User[];
    onConfirm: (name: string, description: string, selectedMemberIds: string[]) => Promise<void>;
}

export const CreateSubgroupModal = ({ isOpen, onClose, parentMembers, onConfirm }: CreateSubgroupModalProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleMember = (uid: string) => {
        const newSet = new Set(selectedMembers);
        if (newSet.has(uid)) {
            newSet.delete(uid);
        } else {
            newSet.add(uid);
        }
        setSelectedMembers(newSet);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Please provide a name for the subgroup");
            return;
        }
        if (selectedMembers.size < 2) {
            setError("A subgroup must have at least 2 members");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await onConfirm(name, description, Array.from(selectedMembers));
            onClose();
            // Reset state
            setName("");
            setDescription("");
            setSelectedMembers(new Set());
        } catch (err: any) {
            setError(err.message || "Failed to create subgroup");
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = parentMembers.filter(m => 
        (m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         m.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-teal-50/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                            <HiUserGroup className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 italic">Create Sub-Activity</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Split costs within a smaller group</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors">
                        <HiX className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Activity Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Goa Trip, Dinner Night"
                                className="h-14 px-6 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Short Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional details..."
                                className="h-14 px-6 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Select Members</label>
                                <p className="text-[10px] text-teal-600 font-bold mt-1 ml-1 uppercase">{selectedMembers.size} selected</p>
                            </div>
                            <div className="relative w-48 group">
                                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search members..."
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:bg-white focus:border-teal-200 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {filteredMembers.map((member) => (
                                <div
                                    key={member.uid}
                                    onClick={() => toggleMember(member.uid)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                                        selectedMembers.has(member.uid)
                                            ? "bg-teal-50 border-teal-200 shadow-sm"
                                            : "bg-gray-50 border-transparent hover:bg-gray-100"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors ${
                                            selectedMembers.has(member.uid) ? "bg-teal-600 text-white" : "bg-white text-gray-400"
                                        }`}>
                                            {(member.displayName || member.username || "U").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-gray-900 truncate">{member.displayName || member.username}</p>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter truncate">@{member.username}</p>
                                        </div>
                                    </div>
                                    {selectedMembers.has(member.uid) && (
                                        <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-200">
                                            <HiCheck className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="p-8 border-t border-gray-50 flex gap-4 bg-gray-50/20">
                    <Button
                        onClick={handleSubmit}
                        isLoading={loading}
                        className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-teal-100"
                    >
                        Initialize Sub-Activity
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="px-8 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-gray-400"
                    >
                        Discard
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};
