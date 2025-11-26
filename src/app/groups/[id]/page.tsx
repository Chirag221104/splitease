"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getGroupDetails, getGroupExpenses, getGroupSettlements, getUsersByIds, getGroupInvites } from "@/lib/firestore";
import { calculateGroupBalances, simplifyDebts } from "@/lib/calculations";
import { getDisplayName } from "@/lib/utils";
import { Group, Expense, Settlement, Transaction, User, Invite } from "@/types";
import { AddMemberForm } from "@/components/groups/AddMemberForm";
import { DeleteConfirmationModal } from "@/components/groups/DeleteConfirmationModal";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { HiPlus, HiCurrencyDollar, HiUserAdd, HiMail, HiHome, HiTrash } from "react-icons/hi";
import { format } from "date-fns";

export default function GroupDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const { showToast } = useToast();
    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [balances, setBalances] = useState<Transaction[]>([]);
    const [members, setMembers] = useState<Record<string, User>>({});
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const fetchData = async () => {
        if (!user || !id) return;
        try {
            const groupData = await getGroupDetails(id);
            setGroup(groupData);

            if (groupData) {
                // Fetch members
                const membersData = await getUsersByIds(groupData.members);
                const membersMap = membersData.reduce((acc, member) => {
                    acc[member.uid] = member;
                    return acc;
                }, {} as Record<string, User>);
                setMembers(membersMap);

                // Fetch invites
                const invitesData = await getGroupInvites(id);
                setInvites(invitesData);

                const expensesData = await getGroupExpenses(id);
                setExpenses(expensesData);

                const settlementsData = await getGroupSettlements(id);
                setSettlements(settlementsData);

                const calculatedBalances = calculateGroupBalances(expensesData, settlementsData, groupData.members);
                const simplified = simplifyDebts(calculatedBalances);
                setBalances(simplified);
            }
        } catch (error) {
            console.error("Error fetching group details:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, id]);

    const getUserName = (uid: string) => {
        if (uid === user?.uid) return "You";
        return getDisplayName(members[uid]);
    };

    if (loading) return <div className="p-4">Loading group details...</div>;
    if (!group) return <div className="p-4">Group not found</div>;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
                        {group.description && (
                            <p className="mt-1 text-gray-500">{group.description}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard">
                            <Button variant="outline" className="flex items-center gap-2">
                                <HiHome className="w-5 h-5" />
                                Dashboard
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                            <HiUserAdd className="w-5 h-5 mr-2" />
                            Invite Member
                        </Button>
                        <Link href={`/groups/${id}/expenses/new`}>
                            <Button className="flex items-center gap-2">
                                <HiPlus className="w-5 h-5" />
                                Add Expense
                            </Button>
                        </Link>
                        <Link href={`/groups/${id}/settle`}>
                            <Button variant="secondary" className="flex items-center gap-2">
                                <HiCurrencyDollar className="w-5 h-5" />
                                Settle Up
                            </Button>
                        </Link>
                        {user?.uid === group.createdBy && (
                            <Button
                                variant="outline"
                                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                <HiTrash className="w-5 h-5" />
                                Delete Group
                            </Button>
                        )}
                    </div>
                </div>

                {showAddMember && (
                    <div className="mt-6 max-w-md">
                        <AddMemberForm groupId={id} onMemberAdded={fetchData} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Expenses */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Expenses</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {expenses.length === 0 ? (
                                <div className="p-6 text-center text-gray-500">
                                    No expenses yet.
                                </div>
                            ) : (
                                expenses.map((expense) => (
                                    <div key={expense.id} className="p-6 hover:bg-gray-50 transition-colors group">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="bg-teal-100 p-3 rounded-lg text-teal-600">
                                                    <span className="text-xs font-bold uppercase">
                                                        {(() => {
                                                            const dateVal = expense.date || expense.createdAt;
                                                            let dateObj: Date;
                                                            if (typeof dateVal === 'number') {
                                                                dateObj = new Date(dateVal);
                                                            } else if (dateVal && typeof (dateVal as any).toDate === 'function') {
                                                                dateObj = (dateVal as any).toDate();
                                                            } else {
                                                                dateObj = new Date();
                                                            }
                                                            return format(dateObj, 'MMM dd');
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900">{expense.description}</p>
                                                    <p className="text-sm text-gray-500">
                                                        Paid by {(() => {
                                                            if (expense.contributors) {
                                                                const contributors = Object.entries(expense.contributors)
                                                                    .filter(([_, amt]) => amt > 0)
                                                                    .map(([uid, amt]) => `${getUserName(uid)} (₹${amt})`)
                                                                    .join(", ");
                                                                return contributors || "Unknown";
                                                            } else if (expense.paidBy) {
                                                                return getUserName(expense.paidBy);
                                                            } else {
                                                                return "Unknown";
                                                            }
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">₹{expense.amount.toFixed(2)}</p>
                                                    <p className="text-xs text-gray-400">{expense.splitType}</p>
                                                </div>
                                                {group.createdBy === user?.uid && (
                                                    <Link
                                                        href={`/groups/${id}/expenses/${expense.id}/edit`}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-teal-600 hover:text-teal-700 text-sm"
                                                    >
                                                        Edit
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Member Spending Summary */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Member Spending</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {group.members.map((memberId) => {
                                const totalSpent = expenses
                                    .filter(e => e.paidBy === memberId)
                                    .reduce((sum, e) => sum + e.amount, 0);
                                const totalOwed = expenses
                                    .flatMap(e => e.splits)
                                    .filter(s => s.userId === memberId)
                                    .reduce((sum, s) => sum + s.amount, 0);
                                const netBalance = totalSpent - totalOwed;

                                return (
                                    <div key={memberId} className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-medium text-gray-900">{getUserName(memberId)}</span>
                                            <span className={`font-bold ${netBalance > 0 ? 'text-teal-600' : netBalance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                                {netBalance > 0 ? '+' : ''}₹{netBalance.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Paid: ₹{totalSpent.toFixed(2)}</span>
                                            <span>Share: ₹{totalOwed.toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Balances & Members */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Balances</h3>
                        {balances.length === 0 ? (
                            <p className="text-sm text-gray-500">All settled up!</p>
                        ) : (
                            <div className="space-y-4">
                                {balances.map((balance, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-700 font-medium">
                                                {getUserName(balance.from)}
                                            </span>
                                            <span className="text-gray-500">owes</span>
                                            <span className="text-gray-700 font-medium">
                                                {getUserName(balance.to)}
                                            </span>
                                        </div>
                                        <span className="font-bold text-gray-900">₹{balance.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Per-Member Balances */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Your Balances With Members</h3>
                        {(() => {
                            // Calculate raw balances to show individual relationships
                            const rawBalances = calculateGroupBalances(expenses, settlements, group.members);
                            const myBalance = rawBalances[user?.uid || ""] || 0;

                            // Calculate pairwise balances with other members
                            const pairwiseBalances: { member: string; amount: number }[] = [];

                            // For each expense, determine who owes whom
                            const memberBalances: Record<string, Record<string, number>> = {};

                            expenses.forEach(expense => {
                                // Handle new multi-contributor format
                                if (expense.contributors) {
                                    // Add contributions
                                    Object.entries(expense.contributors).forEach(([payerId, contributed]) => {
                                        if (!memberBalances[payerId]) memberBalances[payerId] = {};
                                    });

                                    // Subtract what each person owes
                                    expense.splits.forEach(split => {
                                        // For each contributor, track what this person owes them
                                        Object.entries(expense.contributors!).forEach(([payerId, contributed]) => {
                                            if (split.userId !== payerId && contributed > 0) {
                                                const shareOfThisPayer = (contributed / expense.amount) * split.amount;
                                                if (!memberBalances[split.userId]) memberBalances[split.userId] = {};
                                                if (!memberBalances[split.userId][payerId]) memberBalances[split.userId][payerId] = 0;
                                                memberBalances[split.userId][payerId] += shareOfThisPayer;
                                            }
                                        });
                                    });
                                }
                                // Handle old paidBy format
                                else if (expense.paidBy) {
                                    const paidBy = expense.paidBy;
                                    expense.splits.forEach(split => {
                                        if (split.userId !== paidBy) {
                                            // Track that split.userId owes paidBy this amount
                                            if (!memberBalances[split.userId]) memberBalances[split.userId] = {};
                                            if (!memberBalances[split.userId][paidBy]) memberBalances[split.userId][paidBy] = 0;
                                            memberBalances[split.userId][paidBy] += split.amount;
                                        }
                                    });
                                }
                            });

                            // Apply settlements
                            settlements.forEach(settlement => {
                                if (!memberBalances[settlement.fromUser]) memberBalances[settlement.fromUser] = {};
                                if (!memberBalances[settlement.fromUser][settlement.toUser]) {
                                    memberBalances[settlement.fromUser][settlement.toUser] = 0;
                                }
                                memberBalances[settlement.fromUser][settlement.toUser] -= settlement.amount;
                            });

                            // Extract balances for current user
                            const myDebts: { member: string; amount: number }[] = [];

                            // Money I owe to others
                            if (memberBalances[user?.uid || ""]) {
                                Object.entries(memberBalances[user.uid]).forEach(([memberId, amount]) => {
                                    if (amount > 0.01) {
                                        myDebts.push({ member: memberId, amount: -amount }); // negative because I owe
                                    }
                                });
                            }

                            // Money others owe to me
                            Object.entries(memberBalances).forEach(([memberId, debts]) => {
                                if (memberId !== user?.uid && debts[user?.uid || ""]) {
                                    const amount = debts[user.uid];
                                    if (amount > 0.01) {
                                        myDebts.push({ member: memberId, amount }); // positive because they owe me
                                    }
                                }
                            });

                            if (myDebts.length === 0) {
                                return <p className="text-sm text-gray-500">You are all settled up in this group.</p>;
                            }

                            return (
                                <div className="space-y-3">
                                    {myDebts.map((debt, idx) => {
                                        const isOwed = debt.amount > 0;
                                        const memberName = getUserName(debt.member);
                                        const absAmount = Math.abs(debt.amount);

                                        return (
                                            <div key={idx} className="flex justify-between py-2 text-sm border-b border-gray-100 last:border-0">
                                                {isOwed ? (
                                                    <>
                                                        <p className="text-teal-600 font-medium">{memberName} owes you</p>
                                                        <p className="text-teal-600 font-bold">₹{absAmount.toFixed(2)}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-red-500 font-medium">You owe {memberName}</p>
                                                        <p className="text-red-500 font-bold">₹{absAmount.toFixed(2)}</p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Members</h3>
                        <div className="space-y-3">
                            {/* Owner */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-bold">
                                        {getUserName(group.createdBy).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">{getUserName(group.createdBy)}</span>
                                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Owner</span>
                                    </div>
                                </div>
                            </div>

                            {/* Regular Members */}
                            {group.members.filter(memberId => memberId !== group.createdBy).map((memberId) => (
                                <div key={memberId} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-bold">
                                            {getUserName(memberId).slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-gray-600">
                                            {getUserName(memberId)}
                                        </span>
                                    </div>
                                    {user?.uid === group.createdBy && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Remove ${getUserName(memberId)} from the group?`)) {
                                                    try {
                                                        const { removeMember } = await import('@/lib/firestore');
                                                        await removeMember(id, memberId, user.uid);
                                                        await fetchData();
                                                    } catch (error: any) {
                                                        showToast(error.message || 'Failed to remove member', 'error');
                                                    }
                                                }
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {invites.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <h3 className="font-semibold text-gray-900 mb-4">Pending Invites</h3>
                                <div className="space-y-3">
                                    {invites.map((invite) => (
                                        <div key={invite.id} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 text-xs font-bold">
                                                    <HiMail />
                                                </div>
                                                <span className="text-sm text-gray-600">
                                                    {invite.email}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const inviteLink = `${window.location.origin}/invite/confirm?id=${invite.id}`;
                                                    navigator.clipboard.writeText(inviteLink);
                                                    showToast('Invite link copied to clipboard!', 'success');
                                                }}
                                                className="text-xs text-teal-600 hover:text-teal-700 transition-colors"
                                            >
                                                Copy Link
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={async () => {
                    try {
                        const { deleteGroup } = await import('@/lib/firestore');
                        await deleteGroup(id, user!.uid);
                        showToast('Group deleted successfully', 'success');
                        window.location.href = '/dashboard';
                    } catch (error: any) {
                        showToast(error.message || 'Failed to delete group', 'error');
                        setShowDeleteModal(false);
                    }
                }}
                groupName={group.name}
            />
        </div>
    );
}
