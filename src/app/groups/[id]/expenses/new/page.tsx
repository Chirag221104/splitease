"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addExpense, getGroupDetails, getUsersByIds, createActivity, getGroupExpenses, getGroupSettlements } from "@/lib/firestore";
import { calculatePairwiseBalances } from "@/lib/calculations";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, SplitType, Split } from "@/types";
import { HiArrowLeft, HiCheckCircle, HiTag, HiUserGroup, HiOutlineTemplate, HiLightningBolt } from "react-icons/hi";
import { HiCurrencyRupee } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";

export default function AddExpensePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
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
    const [loading, setLoading] = useState(false);
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
        const fetchGroupMembers = async () => {
            if (!id || !user) return;
            try {
                const group = await getGroupDetails(id);
                if (group) {
                    const [users, expenses, settlements] = await Promise.all([
                        getUsersByIds(group.members),
                        getGroupExpenses(id),
                        getGroupSettlements(id)
                    ]);

                    setMembers(users);
                    setSelectedParticipants(new Set(users.map(u => u.uid)));
                    const ledger = calculatePairwiseBalances(expenses, settlements, group.members);
                    setPairwiseLedger(ledger);
                }
            } catch (err) {
                console.error("Error fetching members:", err);
                setError("Failed to load group members");
            }
        };
        fetchGroupMembers();
    }, [id, user]);

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
                // If this is the only one, maybe auto-fill amount?
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

        setLoading(true);
        setError("");

        try {
            const numAmount = parseFloat(amount);
            const splits = calculateSplits();

            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - numAmount) > 0.05) { // Small buffer for rounding
                setError("Split amounts do not equal total. Please check weights.");
                setLoading(false);
                return;
            }

            const contributorsData: Record<string, number> = {};
            Object.entries(contributors).forEach(([uid, amountStr]) => {
                contributorsData[uid] = parseFloat(amountStr || "0");
            });

            await addExpense({
                groupId: id,
                description,
                amount: numAmount,
                contributors: contributorsData,
                date: new Date(date).getTime(),
                splitType,
                splits,
                category,
                createdBy: user.uid
            });

            const contributorDescriptions = Object.entries(contributorsData)
                .filter(([_, amt]) => amt > 0)
                .map(([uid, amt]) => {
                    const member = members.find(m => m.uid === uid);
                    const name = member?.displayName || member?.email || "Someone";
                    return `${name} paid ₹${amt}`;
                });

            const activityDesc = contributorDescriptions.length > 1
                ? `${contributorDescriptions.join(", ")} for "${description}"`
                : `added "${description}"`;

            await createActivity({
                type: "expense",
                groupId: id,
                userId: user.uid,
                amount: numAmount,
                description: activityDesc
            });

            router.push(`/groups/${id}`);
        } catch (err: any) {
            console.error("Error adding expense:", err);
            setError("Failed to add expense");
        } finally {
            setLoading(false);
        }
    };

    const getUserName = (member: User) => {
        return member.uid === user?.uid ? "You" : (member.displayName || member.email?.split('@')[0]);
    };

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
                        Add <span className="text-teal-600">Expense</span>
                    </h1>
                </div>
                <div className="hidden sm:block">
                    <div className="bg-teal-50/60 px-4 py-2 rounded-2xl border border-teal-100/60 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
                        <span className="text-[10px] font-semibold uppercase text-teal-600 tracking-wider">Live Sync Enabled</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* FORM COLUMN */}
                <div className="lg:col-span-8 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-8 sm:p-10 rounded-3xl shadow-lg shadow-gray-100/50 border border-gray-100 space-y-10 relative overflow-hidden"
                    >
                        {/* Decorative background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-bl-full opacity-10 -mr-20 -mt-20 pointer-events-none"></div>

                        <form onSubmit={handleSubmit} className="space-y-12 relative z-10">
                            {/* 1. Basic Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1 flex items-center gap-2">
                                            <HiTag className="w-3 h-3 text-teal-400" /> What's this for?
                                        </label>
                                        <Input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="e.g., Round 1 Cocktails"
                                            className="h-14 px-5 text-base font-medium rounded-2xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-teal-400 transition-all placeholder:text-gray-300"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1 flex items-center gap-2">
                                            <span className="w-3 h-3 text-teal-400 inline-block font-bold">📅</span> When?
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="h-14 px-5 text-base font-medium rounded-2xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-teal-400 transition-all text-gray-700"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1 flex items-center gap-2">
                                        <HiLightningBolt className="w-3 h-3 text-teal-400" /> How much?
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-bold text-teal-500">₹</span>
                                        <Input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="h-14 pl-11 pr-5 text-xl font-bold rounded-2xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-teal-400 transition-all placeholder:text-gray-300"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Category Selection */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Category</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setCategory(cat.value)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${category === cat.value
                                                ? "bg-teal-50 border-teal-500 shadow-sm"
                                                : "bg-gray-50 border-transparent hover:bg-gray-100"
                                                }`}
                                        >
                                            <span className="text-xl">{cat.icon}</span>
                                            <span className={`text-[8px] font-black uppercase tracking-tight ${category === cat.value ? "text-teal-600" : "text-gray-400"
                                                }`}>
                                                {cat.value}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Who Paid */}
                            <div className="space-y-6">
                                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1 flex items-center gap-2">
                                    <HiUserGroup className="w-3 h-3 text-teal-400" /> Who Paid?
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {members.map(member => {
                                        const isSelected = contributors[member.uid] !== undefined;
                                        return (
                                            <motion.div
                                                key={member.uid}
                                                whileHover={{ y: -2 }}
                                                className={`relative cursor-pointer group`}
                                            >
                                                <div
                                                    onClick={() => toggleContributor(member.uid)}
                                                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 text-center ${isSelected
                                                        ? 'bg-teal-50 border-teal-300 shadow-sm text-teal-700'
                                                        : 'bg-white border-gray-100 text-gray-500 hover:border-teal-200'
                                                        }`}
                                                >
                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base ${isSelected ? 'bg-teal-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-teal-50 group-hover:text-teal-500'
                                                        }`}>
                                                        {member.displayName?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-semibold truncate w-full">{getUserName(member)}</span>

                                                    {isSelected && (
                                                        <HiCheckCircle className="absolute top-2 right-2 w-5 h-5 text-teal-500" />
                                                    )}
                                                </div>

                                                <AnimatePresence>
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            className="mt-2"
                                                        >
                                                            <Input
                                                                type="number"
                                                                value={contributors[member.uid]}
                                                                onChange={(e) => updateContribution(member.uid, e.target.value)}
                                                                className="h-10 text-center font-medium rounded-xl border-gray-200 text-sm focus:border-teal-400"
                                                                placeholder="₹0.00"
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Split Config */}
                            <div className="space-y-8">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1 flex items-center gap-2">
                                        <HiOutlineTemplate className="w-3 h-3 text-teal-400" /> Split Policy
                                    </label>
                                    <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                        {(['EQUAL', 'UNEQUAL', 'PERCENTAGE', 'SHARES'] as SplitType[]).map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setSplitType(type)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all ${splitType === type
                                                    ? 'bg-white text-teal-600 shadow-sm border border-teal-100'
                                                    : 'text-gray-400 hover:text-gray-500'
                                                    }`}
                                            >
                                                {type === 'EQUAL' ? 'Equally' : type.replace('AGE', '')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[11px] font-medium text-gray-300 uppercase px-1">Configure weights & participation</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {members.map(member => {
                                            const isActive = selectedParticipants.has(member.uid);
                                            return (
                                                <div
                                                    key={member.uid}
                                                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isActive ? 'bg-teal-50/20 border-teal-100/80' : 'bg-white border-gray-50 opacity-40 grayscale pointer-events-none sm:pointer-events-auto sm:grayscale-0 sm:opacity-100'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isActive}
                                                            onChange={() => toggleParticipant(member.uid)}
                                                            className="w-5 h-5 text-teal-600 rounded-lg focus:ring-teal-500 cursor-pointer"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-gray-800 leading-none">{getUserName(member)}</span>
                                                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tight mt-1">
                                                                {member.uid !== user?.uid ? (
                                                                    (() => {
                                                                        const userOwes = pairwiseLedger[user?.uid || ""]?.[member.uid] || 0;
                                                                        const userIsOwed = pairwiseLedger[member.uid]?.[user?.uid || ""] || 0;
                                                                        if (userOwes > 0) return <span className="text-rose-400">Owes him ₹{userOwes.toLocaleString()}</span>;
                                                                        if (userIsOwed > 0) return <span className="text-teal-500">He owes you ₹{userIsOwed.toLocaleString()}</span>;
                                                                        return 'Settled up';
                                                                    })()
                                                                ) : 'Owner'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {isActive && splitType !== "EQUAL" && (
                                                        <div className="w-24">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={customSplits[member.uid] || (splitType === "SHARES" ? "1" : "0")}
                                                                onChange={(e) => setCustomSplits({ ...customSplits, [member.uid]: e.target.value })}
                                                                className="h-10 font-medium text-center text-sm rounded-xl border-gray-200 focus:border-teal-400 bg-white"
                                                                placeholder={splitType === "PERCENTAGE" ? "%" : splitType === "SHARES" ? "X" : "₹"}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-rose-500 text-xs font-semibold text-center bg-rose-50 py-3 rounded-2xl border border-rose-100"
                                >
                                    {error}
                                </motion.p>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                <Button
                                    type="submit"
                                    isLoading={loading}
                                    className="flex-1 py-5 rounded-2xl text-base font-bold tracking-wide shadow-md shadow-teal-100/50 hover:shadow-lg transition-all"
                                >
                                    Log Transaction
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => router.back()}
                                    className="py-5 px-8 rounded-2xl text-gray-400 font-medium hover:bg-gray-50 transition-all uppercase tracking-wider text-xs"
                                >
                                    Nevermind
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>

                {/* RECEIPT COLUMN */}
                <div className="lg:col-span-4 sticky top-10">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gray-900 text-white p-8 rounded-[40px] shadow-2xl shadow-gray-200 relative overflow-hidden"
                    >
                        {/* Receipt zigzag edge */}
                        <div className="absolute top-0 left-0 w-full h-2 flex">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="flex-1 h-2 bg-white" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}></div>
                            ))}
                        </div>

                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-400 mb-8 border-b border-white/10 pb-4">Live Receipt Preview</h3>

                        <div className="space-y-8">
                            {/* Amount */}
                            <div className="text-center py-6">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Grand Total</p>
                                <p className="text-5xl font-black italic tracking-tighter">
                                    <span className="text-teal-400 not-italic mr-1 text-4xl">₹</span>{totalAmountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* Breakdown */}
                            <div className="space-y-6">
                                <div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div> Funding Sauce
                                    </div>
                                    <div className="space-y-3">
                                        {Object.entries(contributors).map(([uid, val]) => {
                                            const member = members.find(m => m.uid === uid);
                                            const valNum = parseFloat(val) || 0;
                                            if (!member || valNum === 0) return null;
                                            return (
                                                <div key={uid} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                                    <span className="text-xs font-bold text-gray-300">{getUserName(member)}</span>
                                                    <span className="text-sm font-black text-teal-400">₹{valNum.toLocaleString()}</span>
                                                </div>
                                            );
                                        })}
                                        {Object.keys(contributors).length === 0 && <p className="text-[10px] text-gray-600 italic">No payers selected yet</p>}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Distribution
                                    </div>
                                    <div className="space-y-3">
                                        {currentSplits.map(split => {
                                            const member = members.find(m => m.uid === split.userId);
                                            if (!member || split.amount === 0) return null;
                                            return (
                                                <div key={split.userId} className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-xs font-medium text-gray-400">{getUserName(member)}</span>
                                                    <span className="text-xs font-black">₹{split.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                                </div>
                                            );
                                        })}
                                        {currentSplits.length === 0 && <p className="text-[10px] text-gray-600 italic">Selection is empty</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-dashed border-white/20 text-center">
                                <p className="text-[10px] font-bold text-gray-500 italic">SplitEase Premium Internal Voucher</p>
                                <p className="text-[9px] font-medium text-gray-600 mt-1 uppercase tracking-tighter">Powered by chirag malde systems</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
