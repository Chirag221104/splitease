"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getGroupDetails, getGroupExpenses, getGroupSettlements, getUsersByIds, getGroupInvites, deleteExpense } from "@/lib/firestore";
import { calculateGroupBalances, simplifyDebts, calculatePairwiseBalances, calculateExpenseImpact, getSuggestedSettlements } from "@/lib/calculations";
import { getDisplayName } from "@/lib/utils";
import { Group, Expense, Settlement, Transaction, User, Invite } from "@/types";
import { AddMemberForm } from "@/components/groups/AddMemberForm";
import { DeleteConfirmationModal } from "@/components/groups/DeleteConfirmationModal";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { HiHome, HiUserAdd, HiPlus, HiCurrencyDollar, HiTrash, HiMail, HiDownload } from "react-icons/hi";
import { ExportReportModal } from "@/components/groups/ExportReportModal";

const StatCard = ({ label, value, icon, colorClass, delay = 0 }: { label: string, value: string, icon: any, colorClass: string, delay?: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex-1 min-w-[180px] group hover:shadow-md transition-all duration-300`}
    >
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-2xl font-black text-gray-900">{value}</p>
            </div>
        </div>
    </motion.div>
);

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
    const [pairwiseLedger, setPairwiseLedger] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
                const simplified = getSuggestedSettlements(calculatedBalances);
                setBalances(simplified);

                const ledger = calculatePairwiseBalances(expensesData, settlementsData, groupData.members);
                setPairwiseLedger(ledger);
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

    const getBalanceAtExpense = (expenseId: string) => {
        const index = expenses.findIndex(e => e.id === expenseId);
        if (index === -1) return { before: 0, after: 0, impact: 0 };

        // Splitwise usually shows history in chronological order. 
        // We sort by date (already likely sorted, but let's be sure)
        const sortedExpenses = [...expenses].sort((a, b) => a.date - b.date);
        const expenseIndex = sortedExpenses.findIndex(e => e.id === expenseId);

        // Sum up to this expense (inclusive)
        const relevantExpenses = sortedExpenses.slice(0, expenseIndex + 1);
        // Include settlements up to this expense's date
        const relevantSettlements = settlements.filter(s => s.date <= sortedExpenses[expenseIndex].date);

        const balanceAfter = calculateGroupBalances(relevantExpenses, relevantSettlements, [user!.uid])[user!.uid] || 0;

        const impact = calculateExpenseImpact(sortedExpenses[expenseIndex], [user!.uid]).find(t => t.from === user!.uid || t.to === user!.uid);
        let impactAmount = 0;
        if (impact) {
            impactAmount = impact.to === user!.uid ? impact.amount : -impact.amount;
        }

        const balanceBefore = balanceAfter - impactAmount;

        return { before: balanceBefore, after: balanceAfter, impact: impactAmount };
    };

    if (loading) return <div className="p-4">Loading group details...</div>;
    if (!user) return <div className="p-4">You must be logged in.</div>;
    if (!group) return <div className="p-4">Group not found</div>;

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-12">
            {/* Header & Stats */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-4xl font-black text-gray-900 tracking-tight italic"
                        >
                            {group.name}
                        </motion.h1>
                        {group.description && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="mt-2 text-gray-500 font-medium"
                            >
                                {group.description}
                            </motion.p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 justify-end w-full md:w-auto">
                        <Link href="/dashboard">
                            <Button variant="outline" className="rounded-xl border-gray-100 px-4">
                                <HiHome className="w-5 h-5 mr-1" />
                                Dashboard
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => setShowAddMember(!showAddMember)} className="rounded-xl border-gray-100">
                            <HiUserAdd className="w-5 h-5 mr-2" />
                            Invite
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsExportModalOpen(true)}
                            className="rounded-xl border-gray-100"
                        >
                            <HiDownload className="w-5 h-5 mr-2" />
                            Export
                        </Button>
                        <Link href={`/groups/${id}/expenses/new`}>
                            <Button className="rounded-xl shadow-lg shadow-teal-100 px-6">
                                <HiPlus className="w-5 h-5 mr-1" />
                                Expense
                            </Button>
                        </Link>
                        <Link href={`/groups/${id}/settle`}>
                            <Button variant="secondary" className="rounded-xl px-6">
                                <HiCurrencyDollar className="w-5 h-5 mr-1" />
                                Settle
                            </Button>
                        </Link>
                        {user?.uid === group.createdBy && (
                            <Button
                                variant="outline"
                                className="rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                <HiTrash className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <StatCard
                        label="Total Group Spending"
                        value={`₹${expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}`}
                        icon={<HiCurrencyDollar className="w-6 h-6" />}
                        colorClass="bg-teal-50 text-teal-600"
                        delay={0.1}
                    />
                    <StatCard
                        label="Your Balance"
                        value={`${(() => {
                            const balance = calculateGroupBalances(expenses, settlements, [user.uid])[user.uid] || 0;
                            return (balance >= 0 ? "+" : "") + "₹" + Math.abs(balance).toLocaleString();
                        })()}`}
                        icon={<HiCurrencyDollar className="w-6 h-6" />}
                        colorClass={(() => {
                            const balance = calculateGroupBalances(expenses, settlements, [user.uid])[user.uid] || 0;
                            return balance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
                        })()}
                        delay={0.2}
                    />
                    <StatCard
                        label="Group Members"
                        value={group.members.length.toString()}
                        icon={<HiUserAdd className="w-6 h-6" />}
                        colorClass="bg-indigo-50 text-indigo-600"
                        delay={0.3}
                    />
                    <StatCard
                        label="Active Expenses"
                        value={expenses.length.toString()}
                        icon={<HiMail className="w-6 h-6" />}
                        colorClass="bg-amber-50 text-amber-600"
                        delay={0.4}
                    />
                </div>

                <AnimatePresence>
                    {showAddMember && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm overflow-hidden"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Invite new members</h3>
                            <AddMemberForm groupId={id} onMemberAdded={fetchData} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
                {/* Main Content: Expenses */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 italic">Expense History</h3>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{expenses.length} Records</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {expenses.length === 0 ? (
                                <div className="p-12 text-center text-gray-400 font-medium">
                                    No expenses recorded yet.
                                </div>
                            ) : (
                                expenses.map((expense, idx) => (
                                    <motion.div
                                        key={expense.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="p-6 hover:bg-gray-50/50 transition-colors group relative"
                                    >
                                        <div className="flex justify-between items-center gap-4">
                                            <div className="flex items-center gap-6 flex-1 min-w-0">
                                                <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-teal-50 transition-colors duration-300 min-w-[64px] text-center">
                                                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-0.5 group-hover:text-teal-400">
                                                        {(() => {
                                                            const dateVal = expense.date || expense.createdAt;
                                                            let dateObj: Date;
                                                            if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                            else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                            else dateObj = new Date();
                                                            return format(dateObj, 'MMM');
                                                        })()}
                                                    </span>
                                                    <span className="text-lg font-black text-gray-900 group-hover:text-teal-700 block leading-none">
                                                        {(() => {
                                                            const dateVal = expense.date || expense.createdAt;
                                                            let dateObj: Date;
                                                            if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                            else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                            else dateObj = new Date();
                                                            return format(dateObj, 'dd');
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition-colors truncate">
                                                        {expense.description}
                                                    </p>
                                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                                        Paid by <span className="text-gray-900 font-bold">{(() => {
                                                            if (expense.contributors) {
                                                                const contributors = Object.entries(expense.contributors)
                                                                    .filter(([_, amt]) => amt > 0)
                                                                    .map(([uid, amt]) => `${getUserName(uid)}`)
                                                                    .join(", ");
                                                                return contributors || "Unknown";
                                                            } else if (expense.paidBy) {
                                                                return getUserName(expense.paidBy);
                                                            } else {
                                                                return "Unknown";
                                                            }
                                                        })()}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-gray-900">₹{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{expense.splitType}</p>
                                                    {(() => {
                                                        const { before, after, impact } = getBalanceAtExpense(expense.id);
                                                        if (impact === 0 && before === after) return null;
                                                        return (
                                                            <div className="mt-1 flex flex-col items-end">
                                                                <p className={`text-[9px] font-bold uppercase ${impact >= 0 ? 'text-teal-500' : 'text-rose-500'}`}>
                                                                    {impact >= 0 ? '+' : ''}₹{impact.toLocaleString()} impact
                                                                </p>
                                                                <p className="text-[8px] text-gray-400 font-medium">
                                                                    ₹{before.toLocaleString()} → <span className="text-gray-600 font-bold">₹{after.toLocaleString()}</span>
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                {group.createdBy === user?.uid && (
                                                    <Link
                                                        href={`/groups/${id}/expenses/${expense.id}/edit`}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-teal-600 hover:text-teal-700"
                                                    >
                                                        Edit
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Member Spending Summary */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50">
                            <h3 className="text-xl font-black text-gray-900 italic">Member Contributions</h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {group.members.map((memberId) => {
                                const totalSpent = expenses
                                    .filter(e => e.paidBy === memberId || (e.contributors && e.contributors[memberId]))
                                    .reduce((sum, e) => {
                                        if (e.contributors) return sum + (e.contributors[memberId] || 0);
                                        return sum + e.amount;
                                    }, 0);
                                const totalOwed = expenses
                                    .flatMap(e => e.splits)
                                    .filter(s => s.userId === memberId)
                                    .reduce((sum, s) => sum + s.amount, 0);
                                const netBalance = totalSpent - totalOwed;

                                return (
                                    <div key={memberId} className="p-6 bg-gray-50/50 border border-gray-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-lg font-black text-gray-900 italic">{getUserName(memberId)}</span>
                                            <span className={`text-xl font-black ${netBalance > 0 ? 'text-teal-600' : netBalance < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                                                {netBalance > 0 ? '+' : ''}₹{Math.abs(netBalance).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${netBalance >= 0 ? 'bg-teal-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min(100, Math.max(10, (totalSpent / (totalSpent + totalOwed || 1)) * 100))}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                <span>Paid: ₹{totalSpent.toLocaleString()}</span>
                                                <span>Share: ₹{totalOwed.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Balances & Members */}
                <div className="space-y-8 w-full">
                    {/* Persistent Personal Ledger */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <h3 className="text-xl font-black text-gray-900 mb-6 italic">Personal Ledger</h3>
                        {(() => {
                            const userOwes = Object.entries(pairwiseLedger[user.uid] || {}).filter(([_, amt]) => amt > 0.01);
                            const userIsOwed = Object.entries(pairwiseLedger).filter(([uid, otherLedger]) => uid !== user.uid && otherLedger[user.uid] > 0.01);

                            if (userOwes.length === 0 && userIsOwed.length === 0) {
                                return (
                                    <div className="text-center py-4">
                                        <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">No direct balances</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-4">
                                    {userOwes.map(([otherId, amount]) => (
                                        <div key={otherId} className="flex flex-col p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">You owe</span>
                                            <div className="flex justify-between items-end">
                                                <span className="text-sm font-bold text-gray-900">{getUserName(otherId)}</span>
                                                <span className="text-lg font-black text-rose-600">₹{amount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {userIsOwed.map(([otherId, otherLedger]) => (
                                        <div key={otherId} className="flex flex-col p-4 bg-teal-50/50 rounded-2xl border border-teal-100">
                                            <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1">Owes you</span>
                                            <div className="flex justify-between items-end">
                                                <span className="text-sm font-bold text-gray-900">{getUserName(otherId)}</span>
                                                <span className="text-lg font-black text-teal-600">₹{otherLedger[user.uid].toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <h3 className="text-xl font-black text-gray-900 mb-6 italic">Suggested Settlements</h3>
                        {balances.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-emerald-500 font-bold mb-1 italic">Everyone is settled!</p>
                                <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">No transactions needed</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {balances.map((balance, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all">
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-sm font-bold text-gray-900 truncate">{getUserName(balance.from)}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">payer → {getUserName(balance.to)}</span>
                                        </div>
                                        <span className="text-lg font-black text-teal-600">₹{balance.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <h3 className="text-xl font-black text-gray-900 mb-6 italic">Members Area</h3>
                        <div className="space-y-6">
                            {/* Owner */}
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 text-lg font-black shadow-inner shadow-amber-200/50">
                                        {getUserName(group.createdBy).slice(0, 1).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-gray-900 font-bold italic">{getUserName(group.createdBy)}</p>
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Admin</p>
                                    </div>
                                </div>
                            </div>

                            {/* Regular Members */}
                            <div className="space-y-4">
                                {group.members.filter(memberId => memberId !== group.createdBy).map((memberId) => (
                                    <div key={memberId} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-lg font-black group-hover:bg-teal-100 group-hover:text-teal-600 transition-colors">
                                                {getUserName(memberId).slice(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-gray-900 font-bold group-hover:text-teal-600 transition-colors italic">{getUserName(memberId)}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Member</p>
                                            </div>
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
                                                className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-all border-b border-rose-100"
                                            >
                                                Expel
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {invites.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-gray-100">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Pending Invites</h3>
                                <div className="space-y-4">
                                    {invites.map((invite) => (
                                        <div key={invite.id} className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-gray-400 border border-gray-100">
                                                    <HiMail className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 truncate">
                                                    {invite.email}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const inviteLink = `${window.location.origin}/invite/confirm?id=${invite.id}`;
                                                    navigator.clipboard.writeText(inviteLink);
                                                    showToast('Invite link copied!', 'success');
                                                }}
                                                className="text-[10px] font-black text-teal-600 uppercase tracking-widest shrink-0"
                                            >
                                                Link
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
            <ExportReportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                group={group}
                expenses={expenses}
                settlements={settlements}
                members={members}
            />
        </div>
    );
}
