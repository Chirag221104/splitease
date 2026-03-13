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
    const [category, setCategory] = useState("Others");
    const [error, setError] = useState("");

    const categories = [
        { label: "Food & Dining", value: "Food", icon: "🍔" },
        { label: "Travel", value: "Travel", icon: "✈️" },
        { label: "Shopping", value: "Shopping", icon: "🛍️" },
        { label: "Entertainment", value: "Entertainment", icon: "🎬" },
        { label: "Utilities", value: "Utilities", icon: "💡" },
        { label: "Transport", value: "Transport", icon: "🚗" },
        { label: "Rent", value: "Rent", icon: "🏠" },
        { label: "Medical", value: "Medical", icon: "🏥" },
        { label: "Insurance", value: "Insurance", icon: "🛡️" },
        { label: "Others", value: "Others", icon: "📦" }
    ];

    useEffect(() => {
        const fetchExpenseAndGroup = async () => {
            if (!id || !expenseId || !user) return;
            try {
                const expense = await getExpense(expenseId);
                if (!expense) {
                    setError("Expense not found");
                    setLoading(false);
                    return;
                }

                setDescription(expense.description);
                setAmount(expense.amount.toString());
                setSplitType(expense.splitType || "EQUAL");
                setCategory(expense.category || "Others");
                if (expense.date) {
                    const d = new Date(expense.date);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    setDate(d.toISOString().slice(0, 16));
                }

                const initialContributors: Record<string, string> = {};
                if (expense.contributors) {
                    Object.entries(expense.contributors).forEach(([uid, amt]) => {
                        if (amt > 0) initialContributors[uid] = amt.toString();
                    });
                } else if (expense.paidBy) {
                    initialContributors[expense.paidBy] = expense.amount.toString();
                }
                setContributors(initialContributors);

                const initialParticipants = new Set<string>();
                const initialCustomSplits: Record<string, string> = {};

                expense.splits.forEach(split => {
                    initialParticipants.add(split.userId);
                    if (expense.splitType === "PERCENTAGE" && split.percentage) {
                        initialCustomSplits[split.userId] = split.percentage.toString();
                    } else if (expense.splitType === "SHARES" && split.shares) {
                        initialCustomSplits[split.userId] = split.shares.toString();
                    } else {
                        initialCustomSplits[split.userId] = split.amount.toString();
                    }
                });

                setSelectedParticipants(initialParticipants);
                setCustomSplits(initialCustomSplits);

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
        const total = Object.values(contributors).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
        const targetAmount = parseFloat(amount);
        return Math.abs(total - targetAmount) < 0.01;
    };

    const calculateSplits = (): Split[] => {
        const numAmount = parseFloat(amount) || 0;
        const participants = Array.from(selectedParticipants);
        if (participants.length === 0) return [];

        if (splitType === "EQUAL") {
            const perPerson = numAmount / participants.length;
            return participants.map(userId => ({ userId, amount: perPerson }));
        } else if (splitType === "UNEQUAL") {
            return participants.map(userId => ({ userId, amount: parseFloat(customSplits[userId] || "0") }));
        } else if (splitType === "PERCENTAGE") {
            return participants.map(userId => {
                const percentage = parseFloat(customSplits[userId] || "0");
                return { userId, amount: (numAmount * percentage) / 100, percentage };
            });
        } else if (splitType === "SHARES") {
            const totalShares = participants.reduce((sum, uid) => sum + parseFloat(customSplits[uid] || "1"), 0);
            if (totalShares === 0) return participants.map(uid => ({ userId: uid, amount: 0, shares: 0 }));
            return participants.map(userId => {
                const shares = parseFloat(customSplits[userId] || "1");
                return { userId, amount: (numAmount * shares) / totalShares, shares };
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
                category
            }, user.uid);
            router.push(`/groups/${id}`);
        } catch (err: any) {
            console.error("Error updating expense:", err);
            setError("Failed to update expense");
        } finally {
            setSaving(false);
        }
    };

    const getUserName = (member?: User) => {
        if (!member) return "Unknown";
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
                                        <Input
                                            type="datetime-local"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                            className="h-14 bg-gray-50 border-gray-100 text-sm font-semibold rounded-2xl focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">How much? (₹)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        className="h-16 bg-gray-50 border-gray-100 text-3xl font-black rounded-2xl focus:bg-white transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Category</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.value}
                                                type="button"
                                                onClick={() => setCategory(cat.value)}
                                                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all gap-1 ${category === cat.value ? "bg-teal-50 border-teal-500 shadow-sm" : "bg-gray-50 border-transparent hover:bg-gray-100"}`}
                                            >
                                                <span className="text-xl">{cat.icon}</span>
                                                <span className={`text-[8px] font-black uppercase ${category === cat.value ? "text-teal-600" : "text-gray-400"}`}>{cat.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-50 border-dashed my-8" />

                            <div className="space-y-4">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Who Paid?</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {members.map(member => {
                                        const isSelected = contributors[member.uid] !== undefined;
                                        return (
                                            <div
                                                key={`payer-${member.uid}`}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                                                onClick={() => toggleContributor(member.uid)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isSelected ? 'bg-teal-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                        {getUserName(member).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block truncate text-sm font-bold">{getUserName(member)}</span>
                                                        {isSelected && (
                                                            <div className="mt-2" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={contributors[member.uid] || ""}
                                                                    onChange={(e) => updateContribution(member.uid, e.target.value)}
                                                                    className="w-full bg-white border border-teal-100 rounded text-xs font-bold p-1"
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
                            </div>

                            <hr className="border-gray-50 border-dashed my-8" />

                            <div className="space-y-6">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Split Strategy</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: "EQUAL", icon: <HiOutlineTemplate />, label: "Equally" },
                                        { id: "UNEQUAL", icon: <HiTag />, label: "Exact" },
                                        { id: "PERCENTAGE", icon: <HiTag />, label: "%" },
                                        { id: "SHARES", icon: <HiUserGroup />, label: "Shares" },
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setSplitType(type.id as SplitType)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${splitType === type.id ? "bg-teal-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                                        >
                                            {type.icon} {type.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-gray-50 rounded-3xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold">Select participants</span>
                                    </div>
                                    <div className="space-y-2">
                                        {members.map(member => (
                                            <div key={member.uid} className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleParticipant(member.uid)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-2xl border ${selectedParticipants.has(member.uid) ? "bg-white border-teal-100" : "bg-transparent border-transparent"}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${selectedParticipants.has(member.uid) ? "bg-teal-600 text-white" : "border-2 border-gray-200"}`}>
                                                            {selectedParticipants.has(member.uid) && <HiCheckCircle className="w-5 h-5" />}
                                                        </div>
                                                        <span className="text-sm font-bold">{getUserName(member)}</span>
                                                    </div>
                                                </button>
                                                <AnimatePresence>
                                                    {selectedParticipants.has(member.uid) && splitType !== "EQUAL" && (
                                                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                                                            <input
                                                                type="number"
                                                                value={customSplits[member.uid] || ""}
                                                                onChange={(e) => setCustomSplits(prev => ({ ...prev, [member.uid]: e.target.value }))}
                                                                className="w-16 border rounded p-1 text-sm font-bold"
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black" disabled={loading || saving}>
                                    {saving ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900 rounded-3xl p-8 border border-gray-800 text-white sticky top-8">
                        <h3 className="text-lg font-black text-gray-400 mb-6 italic">Live Preview</h3>
                        <div className="mb-8">
                            <p className="text-[10px] font-black uppercase text-teal-400 mb-1 tracking-widest">Total Amount</p>
                            <p className="text-4xl font-black tracking-tight">₹{totalAmountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase text-gray-500 border-b border-gray-800 pb-2 tracking-widest">Effective Split</p>
                            {currentSplits.length === 0 ? (
                                <p className="text-sm font-medium text-gray-600 italic">No participants selected</p>
                            ) : (
                                <div className="space-y-4">
                                    {currentSplits.map((split, i) => {
                                        const m = members.find(u => u.uid === split.userId);
                                        return (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="font-bold">{getUserName(m)}</span>
                                                <span className="font-black text-teal-400">₹{split.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
