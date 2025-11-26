"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getGroupDetails, getUsersByIds, getGroupExpenses, getGroupSettlements, recordSettlement } from "@/lib/firestore";
import { calculateGroupBalances } from "@/lib/calculations";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, Group } from "@/types";
import { HiArrowLeft, HiUser } from "react-icons/hi";
import { getDisplayName } from "@/lib/utils";

export default function SettleUpPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [payerId, setPayerId] = useState("");
    const [recipientId, setRecipientId] = useState("");
    const [amount, setAmount] = useState("");
    const [suggestedPayments, setSuggestedPayments] = useState<{ to: string; amount: number }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!id || !user) return;
            try {
                const groupData = await getGroupDetails(id);
                setGroup(groupData);

                if (groupData) {
                    const membersData = await getUsersByIds(groupData.members);
                    setMembers(membersData);
                    setPayerId(user.uid); // Default to current user paying

                    // Calculate balances to suggest payments
                    const expenses = await getGroupExpenses(id);
                    const settlements = await getGroupSettlements(id);
                    const balances = calculateGroupBalances(expenses, settlements, groupData.members);

                    // Simple logic to find who the user owes
                    // This is a simplified view; a full debt simplification graph is more complex
                    // For now, we just show if the user has a negative balance, they probably owe someone with a positive balance.
                    // A better approach for "Who do I owe?" specifically requires the pairwise debt logic we used in the group page.

                    // Let's replicate the pairwise logic briefly to find direct debts
                    const myDebts: { to: string; amount: number }[] = [];
                    const memberBalances: Record<string, Record<string, number>> = {};

                    expenses.forEach(expense => {
                        // Handle multi-contributor
                        if (expense.contributors) {
                            Object.entries(expense.contributors).forEach(([pId, _]) => {
                                if (!memberBalances[pId]) memberBalances[pId] = {};
                            });
                            expense.splits.forEach(split => {
                                Object.entries(expense.contributors!).forEach(([pId, contributed]) => {
                                    if (split.userId !== pId && contributed > 0) {
                                        const share = (contributed / expense.amount) * split.amount;
                                        if (!memberBalances[split.userId]) memberBalances[split.userId] = {};
                                        if (!memberBalances[split.userId][pId]) memberBalances[split.userId][pId] = 0;
                                        memberBalances[split.userId][pId] += share;
                                    }
                                });
                            });
                        } else if (expense.paidBy) {
                            const pId = expense.paidBy;
                            expense.splits.forEach(split => {
                                if (split.userId !== pId) {
                                    if (!memberBalances[split.userId]) memberBalances[split.userId] = {};
                                    if (!user) return <div className="p-4">You must be logged in.</div>;
                                    if (!memberBalances[split.userId][pId]) memberBalances[split.userId][pId] = 0;
                                    memberBalances[split.userId][pId] += split.amount;
                                }
                            });
                        }
                    });

                    // Subtract settlements
                    settlements.forEach(s => {
                        if (!memberBalances[s.fromUser]) memberBalances[s.fromUser] = {};
                        if (!memberBalances[s.fromUser][s.toUser]) memberBalances[s.fromUser][s.toUser] = 0;
                        memberBalances[s.fromUser][s.toUser] -= s.amount;
                    });

                    // Find what I owe
                    if (memberBalances[user.uid]) {
                        Object.entries(memberBalances[user.uid]).forEach(([toId, amt]) => {
                            if (amt > 0.01) {
                                myDebts.push({ to: toId, amount: amt });
                            }
                        });
                    }
                    setSuggestedPayments(myDebts);

                    // Default recipient to the first person I owe, or just the first other member
                    if (myDebts.length > 0) {
                        setRecipientId(myDebts[0].to);
                        setAmount(myDebts[0].amount.toFixed(2));
                    } else {
                        const firstOther = membersData.find(m => m.uid !== user.uid);
                        if (firstOther) setRecipientId(firstOther.uid);
                    }
                }
            } catch (error) {
                console.error("Error fetching settle up data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payerId || !recipientId || !amount) return;

        setSubmitting(true);
        try {
            await recordSettlement({
                groupId: id,
                fromUser: payerId,
                toUser: recipientId,
                amount: parseFloat(amount),
                date: Date.now() // This will be overwritten by serverTimestamp in firestore.ts but good for type safety if needed
            } as any); // Cast to any because firestore.ts handles the date conversion

            router.push(`/groups/${id}`);
        } catch (error) {
            console.error("Error recording settlement:", error);
            alert("Failed to record settlement");
        } finally {
            setSubmitting(false);
        }
    };

    const getUserName = (uid: string) => {
        const member = members.find(m => m.uid === uid);
        if (!member) return "Unknown";
        return member.uid === user?.uid ? "You" : getDisplayName(member);
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!group) return <div className="p-8 text-center">Group not found</div>;

    return (
        <div className="max-w-md mx-auto">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-teal-600">
                <HiArrowLeft className="w-5 h-5 mr-2" />
                Back to Group
            </Button>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <HiUser className="text-teal-600" />
                    Settle Up
                </h1>

                {suggestedPayments.length > 0 && (
                    <div className="mb-6 bg-teal-50 p-4 rounded-lg border border-teal-100">
                        <h3 className="text-sm font-medium text-teal-800 mb-2">Suggested Payments</h3>
                        <div className="space-y-1">
                            {suggestedPayments.map(payment => (
                                <div key={payment.to} className="text-sm text-teal-700 flex justify-between cursor-pointer hover:bg-teal-100 p-1 rounded"
                                    onClick={() => {
                                        setRecipientId(payment.to);
                                        setAmount(payment.amount.toFixed(2));
                                    }}>
                                    <span>To {getUserName(payment.to)}</span>
                                    <span className="font-bold">₹{payment.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paying</label>
                        <select
                            value={payerId}
                            onChange={(e) => setPayerId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                        >
                            {members.map(member => (
                                <option key={member.uid} value={member.uid}>
                                    {getUserName(member.uid)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center py-2">
                        <span className="text-gray-400">➜</span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To Recipient</label>
                        <select
                            value={recipientId}
                            onChange={(e) => setRecipientId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                        >
                            {members
                                .filter(m => m.uid !== payerId)
                                .map(member => (
                                    <option key={member.uid} value={member.uid}>
                                        {getUserName(member.uid)}
                                    </option>
                                ))}
                        </select>
                    </div>

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

                    <Button type="submit" className="w-full mt-4" isLoading={submitting}>
                        Record Payment
                    </Button>
                </form>
            </div>
        </div>
    );
}
