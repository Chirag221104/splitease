"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getExpense, updateExpense, getGroupDetails, getUsersByIds, createActivity, deleteExpense } from "@/lib/firestore";
import { getDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { User, SplitType, Split } from "@/types";
import { HiArrowLeft, HiTrash } from "react-icons/hi";

export default function EditExpensePage({ params }: { params: Promise<{ id: string; expenseId: string }> }) {
    const { id, expenseId } = use(params);
    const { user } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();

    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [contributors, setContributors] = useState<Record<string, string>>({});
    const [splitType, setSplitType] = useState<SplitType>("EQUAL");
    const [members, setMembers] = useState<User[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
    const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!id || !expenseId || !user) return;
            try {
                const expense = await getExpense(expenseId);
                if (!expense) {
                    setError("Expense not found");
                    return;
                }

                // Load expense data
                setDescription(expense.description);
                setAmount(expense.amount.toString());

                // Load contributors (new multi-contributor support or legacy paidBy)
                if (expense.contributors) {
                    const contributorsData: Record<string, string> = {};
                    Object.entries(expense.contributors).forEach(([uid, amt]) => {
                        contributorsData[uid] = amt.toString();
                    });
                    setContributors(contributorsData);
                } else if (expense.paidBy) {
                    // Legacy single payer - convert to contributors format
                    setContributors({ [expense.paidBy]: expense.amount.toString() });
                }

                setSplitType(expense.splitType);
                setSelectedParticipants(new Set(expense.splits.map(s => s.userId)));

                // Load custom splits if not equal
                if (expense.splitType !== "EQUAL") {
                    const splits: Record<string, string> = {};
                    expense.splits.forEach(split => {
                        if (expense.splitType === "PERCENTAGE" && split.percentage) {
                            splits[split.userId] = split.percentage.toString();
                        } else if (expense.splitType === "SHARES" && split.shares) {
                            splits[split.userId] = split.shares.toString();
                        } else if (expense.splitType === "UNEQUAL") {
                            splits[split.userId] = split.amount.toString();
                        }
                    });
                    setCustomSplits(splits);
                }

                // Fetch group members
                const group = await getGroupDetails(id);
                if (group) {
                    // Check if user is group owner
                    if (group.createdBy !== user.uid) {
                        showToast('Only the group owner can edit expenses', 'error');
                        router.push(`/groups/${id}`);
                        return;
                    }
                    const users = await getUsersByIds(group.members);
                    setMembers(users);
                }
            } catch (err) {
                console.error("Error fetching expense:", err);
                setError("Failed to load expense");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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

            // Validate splits
            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - numAmount) > 0.01) {
                setError(`Split amounts do not equal total: ${totalSplit.toFixed(2)} vs ${numAmount.toFixed(2)}`);
                setSaving(false);
                return;
            }

            // Convert contributors to numbers
            const contributorsData: Record<string, number> = {};
            Object.entries(contributors).forEach(([uid, amountStr]) => {
                contributorsData[uid] = parseFloat(amountStr || "0");
            });

            await updateExpense(expenseId, {
                description,
                amount: numAmount,
                contributors: contributorsData,
                splitType,
                splits
            });

            // Log activity
            const contributorNames = Object.entries(contributorsData)
                .filter(([_, amt]) => amt > 0)
                .map(([uid]) => members.find(m => m.uid === uid)?.displayName || members.find(m => m.uid === uid)?.email || "Someone")
                .join(", ");

            await createActivity({
                type: "expense",
                groupId: id,
                userId: user.uid,
                amount: numAmount,
                description: `updated "${description}" (paid by ${contributorNames})`
            });

            router.push(`/groups/${id}`);
        } catch (err: any) {
            console.error("Error updating expense:", err);
            setError("Failed to update expense");
        } finally {
            setSaving(false);
        }
    };

    const getUserName = (member: User) => {
        return member.uid === user?.uid ? "You" : getDisplayName(member);
    };

    const handleDelete = async () => {
        if (!user) return;
        setDeleting(true);
        try {
            await deleteExpense(expenseId, user.uid);
            showToast('Expense deleted successfully', 'success');
            router.push(`/groups/${id}`);
        } catch (error: any) {
            showToast(error.message || 'Failed to delete expense', 'error');
            setShowDeleteModal(false);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;
    if (error && !amount) return <div className="p-4 text-red-500">{error}</div>;

    const splits = selectedParticipants.size > 0 ? calculateSplits() : [];
    const totalAmount = parseFloat(amount) || 0;

    return (
        <div className="max-w-3xl mx-auto">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-teal-600">
                <HiArrowLeft className="w-5 h-5 mr-2" />
                Back to Group
            </Button>

            <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Expense</h1>

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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paid By (Contributors)
                                </label>
                                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                                    {members.map(member => (
                                        <div key={member.uid} className="flex items-center gap-3 p-2 bg-white rounded hover:bg-gray-50 transition">
                                            <input
                                                type="checkbox"
                                                checked={contributors[member.uid] !== undefined}
                                                onChange={() => toggleContributor(member.uid)}
                                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-900">
                                                {getUserName(member)}
                                            </span>
                                            {contributors[member.uid] !== undefined && (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={contributors[member.uid]}
                                                    onChange={(e) => updateContribution(member.uid, e.target.value)}
                                                    placeholder="₹ Amount paid"
                                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {amount && Object.keys(contributors).length > 0 && !validateContributors() && (
                                    <p className="text-red-500 text-sm mt-2">
                                        Total contributions must equal ₹{parseFloat(amount).toFixed(2)}.
                                        Currently: ₹{Object.values(contributors).reduce((sum, val) => sum + parseFloat(val || "0"), 0).toFixed(2)}
                                    </p>
                                )}
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

                            <div className="flex justify-between items-center pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowDeleteModal(true)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                >
                                    <HiTrash className="w-4 h-4 mr-2" />
                                    Delete Expense
                                </Button>
                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => router.back()}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        isLoading={saving}
                                    >
                                        Update Expense
                                    </Button>
                                </div>
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

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Delete Expense"
                message={`Are you sure you want to delete "${description}"? This action cannot be undone and will affect all group balances.`}
                confirmText="Delete"
                confirmVariant="danger"
                isLoading={deleting}
            />
        </div>
    );
}
