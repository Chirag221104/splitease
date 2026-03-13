"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { updateExpense, getGroupDetails, getUsersByIds, getGroupExpenses, getGroupSettlements, getExpense } from "@/lib/firestore";
import { calculatePairwiseBalances } from "@/lib/calculations";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, SplitType, Split } from "@/types";
import { HiArrowLeft, HiCheckCircle, HiTag, HiOutlineTemplate, HiUserGroup } from "react-icons/hi";
import { HiCurrencyRupee } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";

export default function EditExpensePage({ params }: { params: Promise<{ id: string, expenseId: string }> }) {
    const { id, expenseId } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [contributors, setContributors] = useState<Record<string, string>>({});
    const [splitType, setSplitType] = useState<SplitType>("EQUAL");
    const [members, setMembers] = useState<User[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
    const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pairwiseLedger, setPairwiseLedger] = useState<Record<string, Record<string, number>>>({});
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchExpenseAndGroup = async () => {
            if (!id || !expenseId || !user) return;
            try {
                // Fetch existing expense
                const expense = await getExpense(expenseId);
                if (!expense) {
                    setError("Expense not found");
                    setLoading(false);
                    return;
                }

                // Pre-populate form fields
                setDescription(expense.description);
                setAmount(expense.amount.toString());
                setSplitType(expense.splitType || "EQUAL");
                if (expense.date) {
                    const d = new Date(expense.date);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    setDate(d.toISOString().slice(0, 16));
                }

                // Pre-populate contributors
                const initialContributors: Record<string, string> = {};
                if (expense.contributors) {
                    Object.entries(expense.contributors).forEach(([uid, amt]) => {
                        if (amt > 0) initialContributors[uid] = amt.toString();
                    });
                } else if (expense.paidBy) {
                    initialContributors[expense.paidBy] = expense.amount.toString();
                }
                setContributors(initialContributors);

                // Pre-populate splits
                const initialParticipants = new Set<string>();
                const initialCustomSplits: Record<string, string> = {};

                expense.splits.forEach(split => {
                    initialParticipants.add(split.userId);

                    if (expense.splitType === "PERCENTAGE" && split.percentage) {
                        initialCustomSplits[split.userId] = split.percentage.toString();
                    } else if (expense.splitType === "SHARES" && split.shares) {
                        initialCustomSplits[split.userId] = split.shares.toString();
                    } else {
                        // For UNEQUAL or fallback
                        initialCustomSplits[split.userId] = split.amount.toString();
                    }
                });

                setSelectedParticipants(initialParticipants);
                setCustomSplits(initialCustomSplits);

                // Fetch group members
                const group = await getGroupDetails(id);
                if (group) {
                    const [users, expenses, settlements] = await Promise.all([
                        getUsersByIds(group.members),
                        getGroupExpenses(id),
                        getGroupSettlements(id)
                    ]);

                    setMembers(users);
                    const ledger = calculatePairwiseBalances(expenses, settlements, group.members);
                    setPairwiseLedger(ledger);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load expense details");
            } finally {
                setLoading(false);
            }
        };
        fetchExpenseAndGroup();
    }, [id, expenseId, user]);

    const toggleParticipant = (uid: string) => {
        const newSet = new Set(selectedParticipants);
        if (newSet.has(uid)) {
            newSet.delete(uid);
        } else {
            newSet.add(uid);
        }
        setSelectedParticipants(newSet);
    };

    const toggleContributor = (uid: string) => {
        setContributors(prev => {
            const newContributors = { ...prev };
            if (newContributors[uid] !== undefined) {
                delete newContributors[uid];
            } else {
                newContributors[uid] = "0";
                if (Object.keys(prev).length === 0 && amount) {
                    newContributors[uid] = amount;
                }
            }
            return newContributors;
        });
    };

    const updateContribution = (uid: string, value: string) => {
        setContributors(prev => ({
            ...prev,
            [uid]: value
        }));
    };

    const validateContributors = (): boolean => {
        const total = Object.values(contributors).reduce((sum, val) => {
            return sum + parseFloat(val || "0");
        }, 0);
        const targetAmount = parseFloat(amount);
        return Math.abs(total - targetAmount) < 0.01;
    };

    const calculateSplits = (): Split[] => {
        const numAmount = parseFloat(amount) || 0;
        const participants = Array.from(selectedParticipants);
        if (participants.length === 0) return [];

        if (splitType === "EQUAL") {
            const perPerson = numAmount / participants.length;
            return participants.map(userId => ({
                userId,
                amount: perPerson
            }));
        } else if (splitType === "UNEQUAL") {
            return participants.map(userId => ({
                userId,
                amount: parseFloat(customSplits[userId] || "0")
            }));
        } else if (splitType === "PERCENTAGE") {
            return participants.map(userId => {
                const percentage = parseFloat(customSplits[userId] || "0");
                return {
                    userId,
                    amount: (numAmount * percentage) / 100,
                    percentage
                };
            });
        } else if (splitType === "SHARES") {
            const totalShares = participants.reduce((sum, uid) => {
                return sum + parseFloat(customSplits[uid] || "1");
            }, 0);
            if (totalShares === 0) return participants.map(uid => ({ userId: uid, amount: 0, shares: 0 }));
            return participants.map(userId => {
                const shares = parseFloat(customSplits[userId] || "1");
                return {
                    userId,
                    amount: (numAmount * shares) / totalShares,
                    shares
                };
            });
        }
        return [];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !amount || !description || selectedParticipants.size === 0) {
            setError("Please fill all fields and select at least one participant");
            return;
        }

        if (Object.keys(contributors).length === 0) {
            setError("Please select at least one contributor (who paid)");
            return;
        }

        if (!validateContributors()) {
            const total = Object.values(contributors).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
            setError(`Total contributions must equal ₹${parseFloat(amount).toFixed(2)}. Currently: ₹${total.toFixed(2)}`);
            return;
        }

        setSaving(true);
        setError("");

        try {
            const numAmount = parseFloat(amount);
            const splits = calculateSplits();

            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - numAmount) > 0.05) {
                setError("Split amounts do not equal total. Please check weights.");
                setSaving(false);
                return;
            }

            const contributorsData: Record<string, number> = {};
            Object.entries(contributors).forEach(([uid, amountStr]) => {
                contributorsData[uid] = parseFloat(amountStr || "0");
            });

            await updateExpense(expenseId, {
                description,
                amount: numAmount,
                contributors: contributorsData,
                date: new Date(date).getTime(),
                splitType,
                splits,
            }, user.uid);

            router.push(`/groups/${id}`);
        } catch (err: any) {
            console.error("Error updating expense:", err);
            setError("Failed to update expense");
        } finally {
            setSaving(false);
        }
    };

    const getUserName = (member: User) => {
        return member.uid === user?.uid ? "You" : (member.displayName || member.email?.split('@')[0]);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
    );

    const currentSplits = calculateSplits();
    const totalAmountNum = parseFloat(amount) || 0;

    return (
        <div className="max-w-6xl mx-auto pt-10 px-4 pb-20">
            <header className="mb-10 flex items-center justify-between">
                <div>
                    <motion.button
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-6 transition-colors group"
                    >
                        <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        Back to Group
                    </motion.button>
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
                        Edit <span className="text-teal-600">Expense</span>
                    </h1>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-8 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full opacity-50 -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500"></div>
                        {error && (
                            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-medium flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-pulse"></div>
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">What was it for?</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiTag className="text-gray-400 w-5 h-5" />
                                            </div>
                                            <Input
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="e.g. Dinner at Mario's"
                                                required
                                                className="h-14 pl-12 bg-gray-50 border-gray-100 text-lg rounded-2xl focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">When?</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-gray-400 font-bold text-lg">📅</span>
                                            </div>
                                            <Input
                                                type="datetime-local"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                required
                                                className="h-14 pl-12 pr-4 bg-gray-50 border-gray-100 text-sm font-semibold text-gray-700 rounded-2xl focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">How much?</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-xl">₹</span>
                                        </div>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            required
                                            className="h-16 pl-10 bg-gray-50 border-gray-100 text-3xl font-black rounded-2xl focus:bg-white transition-colors placeholder:text-gray-300 tracking-tight"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-50 border-dashed my-8" />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Who Paid?</label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {members.map(member => {
                                        const isSelected = contributors[member.uid] !== undefined;
                                        return (
                                            <div
                                                key={`payer-${member.uid}`}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-teal-50 border-teal-200 shadow-sm' : 'bg-white border-gray-100 hover:border-teal-100 hover:bg-gray-50'
                                                    }`}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                        toggleContributor(member.uid);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base ${isSelected ? 'bg-teal-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-teal-50 group-hover:text-teal-500'
                                                        }`}>
                                                        {member.displayName?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`block truncate text-sm font-bold ${isSelected ? 'text-teal-900' : 'text-gray-700'}`}>
                                                            {getUserName(member)}
                                                        </span>
                                                        {isSelected && (
                                                            <div className="mt-2 flex items-center bg-white rounded-lg px-2 border border-teal-100" onClick={e => e.stopPropagation()}>
                                                                <span className="text-teal-600 text-xs font-bold mr-1">₹</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={contributors[member.uid] || ""}
                                                                    onChange={(e) => updateContribution(member.uid, e.target.value)}
                                                                    className="w-full bg-transparent text-sm font-bold text-teal-800 outline-none py-1 min-w-[3rem]"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {Object.keys(contributors).length > 0 && !validateContributors() && (
                                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest text-right mt-2">
                                        Warning: Total paid does not match expense amount
                                    </p>
                                )}
                            </div>

                            <hr className="border-gray-50 border-dashed my-8" />

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Split Strategy</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: "EQUAL", icon: <HiOutlineTemplate />, label: "Equally" },
                                        { id: "UNEQUAL", icon: <HiTag />, label: "Exact amounts" },
                                        { id: "PERCENTAGE", icon: <HiTag />, label: "Percentages" },
                                        { id: "SHARES", icon: <HiUserGroup />, label: "By shares" },
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setSplitType(type.id as SplitType)}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${splitType === type.id
                                                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                                                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                                                }`}
                                        >
                                            {type.icon}
                                            {type.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-gray-50/50 border border-gray-100 rounded-3xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold text-gray-900">Select participants</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedParticipants.size === members.length) {
                                                    setSelectedParticipants(new Set());
                                                } else {
                                                    setSelectedParticipants(new Set(members.map(m => m.uid)));
                                                }
                                            }}
                                            className="text-[10px] font-black text-teal-600 hover:text-teal-700 uppercase tracking-widest"
                                        >
                                            {selectedParticipants.size === members.length ? "Clear All" : "Select All"}
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {members.map(member => (
                                            <div key={member.uid} className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleParticipant(member.uid)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${selectedParticipants.has(member.uid)
                                                        ? "bg-white border-teal-100 shadow-sm"
                                                        : "bg-transparent hover:bg-white border-transparent"
                                                        } border`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${selectedParticipants.has(member.uid) ? "bg-teal-600 text-white" : "border-2 border-gray-200"
                                                            }`}>
                                                            {selectedParticipants.has(member.uid) && <HiCheckCircle className="w-5 h-5" />}
                                                        </div>
                                                        <span className={`text-sm font-bold ${selectedParticipants.has(member.uid) ? "text-gray-900" : "text-gray-500"}`}>
                                                            {getUserName(member)}
                                                        </span>
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {selectedParticipants.has(member.uid) && splitType !== "EQUAL" && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9, width: 0 }}
                                                            animate={{ opacity: 1, scale: 1, width: "auto" }}
                                                            exit={{ opacity: 0, scale: 0.9, width: 0 }}
                                                            className="shrink-0"
                                                        >
                                                            <div className="flex items-center bg-white rounded-xl px-3 py-1.5 border border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-50 transition-all">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step={splitType === "UNEQUAL" ? "0.01" : "1"}
                                                                    placeholder="0"
                                                                    value={customSplits[member.uid] || ""}
                                                                    onChange={(e) => setCustomSplits(prev => ({ ...prev, [member.uid]: e.target.value }))}
                                                                    className="w-16 outline-none text-right font-bold text-gray-900 text-sm"
                                                                />
                                                                <span className="text-xs font-bold text-gray-400 ml-1.5 w-4 inline-block text-left">
                                                                    {splitType === "PERCENTAGE" ? "%" : splitType === "SHARES" ? "s" : ""}
                                                                </span>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button
                                    type="submit"
                                    className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-teal-600/20 hover:shadow-teal-600/30 transition-shadow"
                                    disabled={loading || saving}
                                >
                                    {saving ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving Changes...
                                        </div>
                                    ) : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>

                {/* SUMMARY COLUMN */}
                <div className="lg:col-span-4 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gray-900 rounded-3xl p-8 border border-gray-800 text-white shadow-xl sticky top-8"
                    >
                        <h3 className="text-lg font-black italic text-gray-400 mb-6">Live Preview</h3>

                        <div className="mb-8">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-1">Total Amount</p>
                            <p className="text-5xl font-black tracking-tight"><span className="text-gray-600 mr-1">₹</span>{totalAmountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800 pb-2">Effective Split</p>
                            {currentSplits.length === 0 ? (
                                <p className="text-sm font-medium text-gray-600 italic">No participants selected</p>
                            ) : (
                                currentSplits.map((split, i) => {
                                    const member = members.find(m => m.uid === split.userId);
                                    if (!member) return null;
                                    const details = splitType === "PERCENTAGE" ? `${split.percentage}%` :
                                        splitType === "SHARES" ? `${split.shares} share(s)` : null;

                                    return (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                    {(getUserName(member) || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold block">{getUserName(member)}</span>
                                                    {details && <span className="text-[10px] text-gray-500 tracking-wide">{details}</span>}
                                                </div>
                                            </div>
                                            <span className="font-black text-teal-400">₹{split.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )
                                })
                            )}

                            {currentSplits.length > 0 && splitType !== "EQUAL" && (
                                <div className="pt-4 mt-4 border-t border-gray-800 flex justify-between items-center text-xs">
                                    <span className="font-bold text-gray-500">Total Allocated:</span>
                                    <span className={`font-black ${Math.abs(currentSplits.reduce((s, a) => s + a.amount, 0) - totalAmountNum) < 0.05 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        ₹{currentSplits.reduce((s, a) => s + a.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
