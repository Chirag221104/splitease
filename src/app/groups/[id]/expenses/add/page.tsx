"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addExpense, getGroupDetails, getUsersByIds, createActivity } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, SplitType, Split } from "@/types";
import { HiArrowLeft, HiCheckCircle } from "react-icons/hi";

export default function AddExpensePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("");
    const [splitType, setSplitType] = useState<SplitType>("EQUAL");
    const [members, setMembers] = useState<User[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
    const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchGroupMembers = async () => {
            if (!id || !user) return;
            try {
                const group = await getGroupDetails(id);
                if (group) {
                    const users = await getUsersByIds(group.members);
                    setMembers(users);
                    setPaidBy(user.uid);
                    // Select all participants by default
                    setSelectedParticipants(new Set(users.map(u => u.uid)));
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

    const calculateSplits = (): Split[] => {
        const numAmount = parseFloat(amount);
        const participants = Array.from(selectedParticipants);

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

        setLoading(true);
        setError("");

        try {
            const numAmount = parseFloat(amount);
            const splits = calculateSplits();

            // Validate splits
            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - numAmount) > 0.01) {
                setError(`Split amounts do not equal total: ${totalSplit.toFixed(2)} vs ${numAmount.toFixed(2)}`);
                setLoading(false);
                return;
            }

            await addExpense({
                groupId: id,
                description,
                amount: numAmount,
                paidBy,
                date: Date.now(),
                splitType,
                splits,
                createdBy: user.uid
            });

            // Log activity
            const payerName = members.find(m => m.uid === paidBy)?.displayName || members.find(m => m.uid === paidBy)?.email || "Someone";
            await createActivity({
                type: "expense",
                groupId: id,
                userId: user.uid,
                amount: numAmount,
                description: `added "${description}" (paid by ${payerName})`
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
        return member.uid === user?.uid ? "You" : (member.displayName || member.email);
    };

    const splits = selectedParticipants.size > 0 ? calculateSplits() : [];
    const totalAmount = parseFloat(amount) || 0;

    return (
        <div className="max-w-3xl mx-auto">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-teal-600">
                <HiArrowLeft className="w-5 h-5 mr-2" />
                Back to Group
            </Button>

            <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Expense</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., Dinner at Taj"
                                required
                            />

                            <Input
                                label="Amount (₹)"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                required
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Paid By</label>
                                <select
                                    value={paidBy}
                                    onChange={(e) => setPaidBy(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    {members.map(member => (
                                        <option key={member.uid} value={member.uid}>
                                            {getUserName(member)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Split Type</label>
                                <select
                                    value={splitType}
                                    onChange={(e) => setSplitType(e.target.value as SplitType)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="EQUAL">Split Equally</option>
                                    <option value="UNEQUAL">Exact Amounts</option>
                                    <option value="PERCENTAGE">By Percentage</option>
                                    <option value="SHARES">By Shares</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Participants</label>
                                <div className="space-y-2">
                                    {members.map(member => (
                                        <div key={member.uid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <input
                                                type="checkbox"
                                                checked={selectedParticipants.has(member.uid)}
                                                onChange={() => toggleParticipant(member.uid)}
                                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-900">{getUserName(member)}</span>

                                            {selectedParticipants.has(member.uid) && splitType !== "EQUAL" && (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={customSplits[member.uid] || (splitType === "SHARES" ? "1" : "0")}
                                                    onChange={(e) => setCustomSplits({ ...customSplits, [member.uid]: e.target.value })}
                                                    placeholder={splitType === "PERCENTAGE" ? "%" : splitType === "SHARES" ? "shares" : "₹"}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm">{error}</p>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => router.back()}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={loading}
                                >
                                    Save Expense
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Preview Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-4">
                        <h3 className="font-semibold text-gray-900 mb-4">Split Preview</h3>
                        {totalAmount > 0 && selectedParticipants.size > 0 ? (
                            <div className="space-y-2">
                                {splits.map((split) => {
                                    const member = members.find(m => m.uid === split.userId);
                                    if (!member) return null;
                                    return (
                                        <div key={split.userId} className="flex justify-between items-center text-sm pb-2 border-b border-gray-100">
                                            <span className="text-gray-600">{getUserName(member)}</span>
                                            <span className="font-medium text-gray-900">₹{split.amount.toFixed(2)}</span>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-center text-sm pt-2 font-bold">
                                    <span>Total</span>
                                    <span className="text-teal-600">₹{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Enter amount and select participants to see preview</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
