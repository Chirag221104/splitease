"use client";

import { useState } from "react";
import { Group } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import { HiX, HiPencil, HiCalendar, HiDocumentText } from "react-icons/hi";
import { format } from "date-fns";

interface EditGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: Partial<Group>) => Promise<void>;
    group: Group;
}

export const EditGroupModal = ({ isOpen, onClose, onConfirm, group }: EditGroupModalProps) => {
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description || "");
    const [startDate, setStartDate] = useState(group.startDate ? format(new Date(group.startDate), "yyyy-MM-dd") : "");
    const [endDate, setEndDate] = useState(group.endDate ? format(new Date(group.endDate), "yyyy-MM-dd") : "");
    const [budgetLimit, setBudgetLimit] = useState(group.budgetLimit?.toString() || "");
    const [budgetPeriod, setBudgetPeriod] = useState<Group['budgetPeriod']>(group.budgetPeriod || 'trip');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const startTimestamp = startDate ? new Date(startDate).getTime() : undefined;
            const endTimestamp = endDate ? new Date(endDate).getTime() : undefined;

            await onConfirm({
                name,
                description,
                startDate: startTimestamp,
                endDate: endTimestamp,
                budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
                budgetPeriod
            });
            onClose();
        } catch (error) {
            console.error("Error updating group:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-[2.5rem] p-8 sm:p-10 w-full max-w-lg shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-teal-50 rounded-bl-[100px] -z-10 opacity-50" />

                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                                    <HiPencil className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 italic">Edit Circle</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                                <HiX className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Circle Name</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Group Name"
                                    className="h-14 px-6 font-bold rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all shadow-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Description</label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
                                        <HiDocumentText className="w-5 h-5" />
                                    </div>
                                    <Input
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What's this for?"
                                        className="h-14 pl-14 pr-6 font-medium rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Budget Limit</label>
                                    <div className="relative">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none font-bold">₹</div>
                                        <Input
                                            type="number"
                                            value={budgetLimit}
                                            onChange={(e) => setBudgetLimit(e.target.value)}
                                            placeholder="0.00"
                                            className="h-14 pl-10 pr-6 font-bold rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Period</label>
                                    <div className="flex bg-gray-50 p-1.5 rounded-2xl h-14 border-2 border-gray-50">
                                        <button
                                            type="button"
                                            onClick={() => setBudgetPeriod('trip')}
                                            className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${budgetPeriod === 'trip' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}
                                        >
                                            Trip
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBudgetPeriod('monthly')}
                                            className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${budgetPeriod === 'monthly' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}
                                        >
                                            Monthly
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Trip Starts</label>
                                    <div className="relative group/date">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/date:text-teal-500 transition-colors z-10 pointer-events-none">
                                            <HiCalendar className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-14 pl-12 pr-4 w-full text-sm font-bold rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all outline-none shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Trip Ends</label>
                                    <div className="relative group/date">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/date:text-teal-500 transition-colors z-10 pointer-events-none">
                                            <HiCalendar className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="h-14 pl-12 pr-4 w-full text-sm font-bold rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all outline-none shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="flex-1 h-14 rounded-2xl text-gray-400 font-bold hover:bg-gray-50 uppercase tracking-widest text-[10px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={loading}
                                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-teal-100"
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
