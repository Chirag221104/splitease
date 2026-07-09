"use client";

import { useEffect, useState, use } from "react";
import { collection, query, doc, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getGroupDetails, getGroupExpenses, getGroupSettlements, getUsersByIds, getGroupInvites, deleteExpense, updateGroup, getSubgroups, createSubgroup } from "@/lib/firestore";
import { calculateGroupBalances, simplifyDebts, calculatePairwiseBalances, calculateExpenseImpact, getSuggestedSettlements } from "@/lib/calculations";
import { getDisplayName } from "@/lib/utils";
import { Group, Expense, Settlement, Transaction, User, Invite, Balance } from "@/types";
import { AddMemberForm } from "@/components/groups/AddMemberForm";
import { DeleteConfirmationModal } from "@/components/groups/DeleteConfirmationModal";
import { EditGroupModal } from "@/components/groups/EditGroupModal";
import { CreateSubgroupModal } from "@/components/groups/CreateSubgroupModal";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { HiHome, HiUserAdd, HiPlus, HiTrash, HiMail, HiDownload, HiArrowLeft, HiArrowRight, HiPencil, HiInformationCircle, HiChevronDown, HiChevronUp, HiChartBar, HiClipboardList, HiCalendar, HiUserGroup, HiCheckCircle } from "react-icons/hi";
import { HiCurrencyRupee } from "react-icons/hi2";
import { ExportReportModal } from "@/components/groups/ExportReportModal";
import GroupAnalytics from "@/components/groups/GroupAnalytics";

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
    const router = useRouter();
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
    const [netBalances, setNetBalances] = useState<Balance>({});
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"expenses" | "insights">("expenses");
    const [subgroups, setSubgroups] = useState<Group[]>([]);
    const [showSubgroupModal, setShowSubgroupModal] = useState(false);
    const [parentGroup, setParentGroup] = useState<Group | null>(null);
    const [parentMembersProfiles, setParentMembersProfiles] = useState<User[]>([]);
    const [isOverallView, setIsOverallView] = useState(true);
    const [totalSpending, setTotalSpending] = useState(0);
    const [displayExpenses, setDisplayExpenses] = useState<Expense[]>([]);
    const [displaySettlements, setDisplaySettlements] = useState<Settlement[]>([]);

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
                const settlementsData = await getGroupSettlements(id);

                // Fetch subgroups
                const subgroupsData = await getSubgroups(id, user.uid);
                setSubgroups(subgroupsData);

                let currentExpenses = expensesData;
                let currentSettlements = settlementsData;

                // AGGREGATION LOGIC
                if (isOverallView && !groupData.parentId && subgroupsData.length > 0) {
                    // Scenario A: Parent Group (Overall View) - Aggregate all subgroups
                    const allSubgroupExpenses = await Promise.all(subgroupsData.map(s => getGroupExpenses(s.id)));
                    const allSubgroupSettlements = await Promise.all(subgroupsData.map(s => getGroupSettlements(s.id)));

                    const combinedExpenses = [...expensesData, ...allSubgroupExpenses.flat()];
                    const combinedSettlements = [...settlementsData, ...allSubgroupSettlements.flat()];

                    // Deduplicate by ID
                    currentExpenses = Array.from(new Map(combinedExpenses.map(e => [e.id, e])).values());
                    currentSettlements = Array.from(new Map(combinedSettlements.map(s => [s.id, s])).values());
                } else if (groupData.parentId) {
                    // Scenario B: Subgroup - Inherit settlements from parent group
                    const parentSettlements = await getGroupSettlements(groupData.parentId);
                    const combinedSettlements = [...settlementsData, ...parentSettlements];
                    
                    // Deduplicate settlements
                    currentSettlements = Array.from(new Map(combinedSettlements.map(s => [s.id, s])).values());
                    // Expenses stay local to the subgroup
                }

                setDisplayExpenses(currentExpenses);
                setDisplaySettlements(currentSettlements);

                setExpenses(expensesData); // Keep history group-specific
                setSettlements(settlementsData);

                // Use display data for balances and stats
                const calculatedBalances = calculateGroupBalances(currentExpenses, currentSettlements, groupData.members);
                setNetBalances(calculatedBalances);

                const ledger = calculatePairwiseBalances(currentExpenses, currentSettlements, groupData.members);
                setPairwiseLedger(ledger);

                const simplified = simplifyDebts(calculatedBalances);
                setBalances(simplified);

                // For the stats cards, we'll use these aggregated values
                setTotalSpending(currentExpenses.reduce((sum, e) => sum + e.amount, 0));

                // Fetch parent group if this is a subgroup
                if (groupData.parentId) {
                    const parentData = await getGroupDetails(groupData.parentId);
                    setParentGroup(parentData);
                    if (parentData) {
                        const profiles = await getUsersByIds(parentData.members);
                        setParentMembersProfiles(profiles);
                    }
                } else {
                    setParentGroup(null);
                    setParentMembersProfiles([]);
                }
            }
        } catch (error) {
            console.error("Error fetching group details:", error);
            showToast("Failed to load group details", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        if (!id || !user) return;

        // Set up real-time listeners on the correct top-level collections
        const expensesQuery = query(collection(db, "expenses"), where("groupId", "==", id));
        const settlementsQuery = query(collection(db, "settlements"), where("groupId", "==", id));
        const groupRef = doc(db, "groups", id);

        const unsubGroup = onSnapshot(groupRef, (snapshot) => {
            if (snapshot.exists()) {
                fetchData();
            }
        });

        const unsubExpenses = onSnapshot(expensesQuery, () => {
            fetchData();
        });

        const unsubSettlements = onSnapshot(settlementsQuery, () => {
            fetchData();
        });

        // If in overall view, we should also listen to subgroups
        // For simplicity and to avoid too many listeners, we trigger fetchData 
        // which already handles the aggregation.
        
        return () => {
            unsubGroup();
            unsubExpenses();
            unsubSettlements();
        };
    }, [id, user, isOverallView]);

    const handleDeleteSettlement = async (settlementId: string) => {
        if (!confirm("Are you sure you want to delete this payment record?")) return;
        try {
            const { deleteDoc, doc, addDoc, collection, serverTimestamp } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            await deleteDoc(doc(db, "settlements", settlementId));
            
            // Log activity
            await addDoc(collection(db, "activities"), {
                type: "settle_deleted",
                groupId: id,
                userId: user?.uid,
                description: `deleted a payment record`,
                createdAt: serverTimestamp()
            });

            await fetchData();
        } catch (error) {
            console.error("Error deleting settlement:", error);
            alert("Failed to delete settlement");
        }
    };

    const handleDeleteExpense = async (expense: Expense) => {
        if (!confirm(`Are you sure you want to delete the expense "${expense.description}"?`)) return;
        try {
            await deleteExpense(expense.id, user!.uid);
            showToast("Expense deleted successfully", "success");
            await fetchData();
        } catch (error) {
            console.error("Error deleting expense:", error);
            showToast("Failed to delete expense", "error");
        }
    };

    const getUserName = (uid: string) => {
        if (uid === user?.uid) return "You";
        return getDisplayName(members[uid]);
    };

    const getBalanceAtExpense = (expenseId: string) => {
        const index = expenses.findIndex(e => e.id === expenseId);
        if (index === -1) return { before: 0, after: 0, impact: 0 };

        // Splitwise usually shows history in chronological order. 
        // We sort by date (already likely sorted, but let's be sure)
        const getVal = (d: any) => {
            if (typeof d === 'number') return d;
            if (d?.seconds) return d.seconds * 1000;
            return 0;
        };

        const sortedExpenses = [...expenses].sort((a, b) => getVal(a.date || a.createdAt) - getVal(b.date || b.createdAt));
        const expenseIndex = sortedExpenses.findIndex(e => e.id === expenseId);

        // Sum up to this expense (inclusive)
        const relevantExpenses = sortedExpenses.slice(0, expenseIndex + 1);
        // Include settlements up to this expense's date
        const targetDate = getVal(sortedExpenses[expenseIndex].date || sortedExpenses[expenseIndex].createdAt);
        const relevantSettlements = settlements.filter(s => getVal(s.date) <= targetDate);

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
        <div className="space-y-10 max-w-7xl mx-auto pb-12 pt-16 px-4">
            {/* Header & Stats */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div>
                        <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => router.push(group.parentId ? `/groups/${group.parentId}` : '/groups')}
                            className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-4 transition-colors group"
                        >
                            <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                            {group.parentId ? `Return to ${parentGroup?.name || 'Parent'}` : 'Return to Circles'}
                        </motion.button>
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
                    {/* Desktop Actions */}
                    <div className="hidden md:flex flex-wrap gap-3 justify-end w-full md:w-auto">
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
                        {!group.parentId && (
                            <Button
                                variant="outline"
                                onClick={() => setShowSubgroupModal(true)}
                                className="rounded-xl border-gray-100 bg-teal-50/30 text-teal-700 hover:bg-teal-50 border-teal-100/50"
                            >
                                <HiUserGroup className="w-5 h-5 mr-2" />
                                Sub-Activity
                            </Button>
                        )}
                        <Link href={`/groups/${id}/expenses/new`}>
                            <Button className="rounded-xl shadow-lg shadow-teal-100 px-6">
                                <HiPlus className="w-5 h-5 mr-1" />
                                Expense
                            </Button>
                        </Link>
                        <Link href={`/groups/${id}/settle`}>
                            <Button variant="secondary" className="rounded-xl px-6">
                                <HiCurrencyRupee className="w-5 h-5 mr-1" />
                                Settle
                            </Button>
                        </Link>
                        {user?.uid === group.createdBy && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl border-gray-100 p-3"
                                    onClick={() => setShowEditModal(true)}
                                    title="Edit Circle Settings"
                                >
                                    <HiPencil className="w-5 h-5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 p-3"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    <HiTrash className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <StatCard
                        label="Total Group Spending"
                        value={`₹${(isOverallView ? displayExpenses : expenses).reduce((sum, e) => sum + e.amount, 0).toLocaleString()}`}
                        icon={<HiCurrencyRupee className="w-6 h-6" />}
                        colorClass="bg-teal-50 text-teal-600"
                        delay={0.1}
                    />
                    <StatCard
                        label="Your Balance"
                        value={`${(() => {
                            const sourceExpenses = isOverallView ? displayExpenses : expenses;
                            const sourceSettlements = isOverallView ? displaySettlements : settlements;
                            const balance = calculateGroupBalances(sourceExpenses, sourceSettlements, [user.uid])[user.uid] || 0;
                            return (balance >= 0 ? "+" : "") + "₹" + Math.abs(balance).toLocaleString();
                        })()}`}
                        icon={<HiCurrencyRupee className="w-6 h-6" />}
                        colorClass={(() => {
                            const sourceExpenses = isOverallView ? displayExpenses : expenses;
                            const sourceSettlements = isOverallView ? displaySettlements : settlements;
                            const balance = calculateGroupBalances(sourceExpenses, sourceSettlements, [user.uid])[user.uid] || 0;
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
                        icon={<HiClipboardList className="w-6 h-6" />}
                        colorClass="bg-amber-50 text-amber-600"
                        delay={0.4}
                    />
                    {group.startDate && group.endDate && (
                        <StatCard
                            label="Trip Duration"
                            value={`${Math.ceil((group.endDate - group.startDate) / (1000 * 60 * 60 * 24)) + 1} Days`}
                            icon={<HiCalendar className="w-6 h-6" />}
                            colorClass="bg-rose-50 text-rose-600"
                            delay={0.5}
                        />
                    )}
                </div>

                <AnimatePresence>
                    {showAddMember && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white p-6 rounded-3xl border border-teal-100 shadow-sm overflow-hidden"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">{group.parentId ? 'Add members from parent group' : 'Invite new members'}</h3>
                            <AddMemberForm groupId={id} groupName={group.name} onMemberAdded={fetchData} currentMembers={group.members} parentMembers={group.parentId ? parentMembersProfiles : undefined} isGroupCreator={group.createdBy === user?.uid} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
                {/* Main Content: Expenses */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-100/50 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab("expenses")}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "expenses"
                                ? "bg-white text-teal-600 shadow-sm"
                                : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            <HiClipboardList className="w-4 h-4" />
                            Expenses
                        </button>
                        <button
                            onClick={() => setActiveTab("insights")}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "insights"
                                ? "bg-white text-teal-600 shadow-sm"
                                : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            <HiChartBar className="w-4 h-4" />
                            Visual Insights
                        </button>
                    </div>

                    {activeTab === "insights" ? (
                        <GroupAnalytics expenses={isOverallView ? displayExpenses : expenses} members={Object.values(members)} group={group} />
                    ) : (
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                <h3 className="text-xl font-black text-gray-900 italic">Expense History</h3>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{expenses.length} Records</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {displayExpenses.length === 0 && displaySettlements.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400 font-medium">
                                        No transactions recorded yet.
                                    </div>
                                ) : (
                                    [
                                        ...displayExpenses.map(e => ({ ...e, type: 'expense' })),
                                        ...displaySettlements.map(s => ({ ...s, type: 'settlement' }))
                                    ].sort((a: any, b: any) => {
                                        const dateA = a.date || a.createdAt || 0;
                                        const dateB = b.date || b.createdAt || 0;
                                        const timeA = typeof dateA === 'number' ? dateA : (dateA?.seconds ? dateA.seconds * 1000 : 0);
                                        const timeB = typeof dateB === 'number' ? dateB : (dateB?.seconds ? dateB.seconds * 1000 : 0);
                                        return timeA - timeB; // Ascending: Oldest first
                                    }).map((item: any, idx) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className={`p-6 transition-colors group relative ${item.type === 'settlement' ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-gray-50/50'}`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-6">
                                                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                                                    <div className={`p-3 rounded-2xl transition-colors duration-300 min-w-[72px] shrink-0 text-center flex flex-col items-center justify-center ${item.type === 'settlement' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400 group-hover:bg-teal-50 group-hover:text-teal-500'}`}>
                                                        <span className="text-[10px] font-black uppercase tracking-widest mb-0.5">
                                                            {(() => {
                                                                const dateVal = item.date || item.createdAt;
                                                                let dateObj: Date;
                                                                if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                                else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                                else dateObj = new Date();
                                                                return format(dateObj, 'MMM');
                                                            })()}
                                                        </span>
                                                        <span className="text-xl font-black block leading-tight mb-0.5 text-gray-900">
                                                            {(() => {
                                                                const dateVal = item.date || item.createdAt;
                                                                let dateObj: Date;
                                                                if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                                else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                                else dateObj = new Date();
                                                                return format(dateObj, 'dd');
                                                            })()}
                                                        </span>
                                                        <span className="text-[9px] font-bold whitespace-nowrap">
                                                            {(() => {
                                                                const dateVal = item.date || item.createdAt;
                                                                let dateObj: Date;
                                                                if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                                else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                                else dateObj = new Date();
                                                                return format(dateObj, 'h:mm a');
                                                            })()}
                                                        </span>
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="text-base font-black text-gray-900 truncate">
                                                                {item.type === 'expense' ? item.description : (
                                                                    <span className="flex items-center gap-2">
                                                                        {getUserName(item.fromUser)} paid {getUserName(item.toUser)}
                                                                        <HiCheckCircle className="text-emerald-500 w-4 h-4" />
                                                                    </span>
                                                                )}
                                                            </h4>
                                                            {item.groupId !== id && (
                                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                                                                    Subgroup
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                            {item.type === 'expense' ? (
                                                                <>Paid by <span className="text-gray-900">{getUserName(item.paidBy || Object.keys(item.contributors || {})[0])}</span></>
                                                            ) : (
                                                                <span className="text-emerald-600">Settlement</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-6 pl-[88px] sm:pl-0">
                                                    <div className="text-right shrink-0">
                                                        <p className={`text-xl font-black italic tracking-tight ${item.type === 'settlement' ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                            ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </p>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            {item.type === 'expense' ? (item.splitType || 'EQUAL') : 'Payment'}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {item.type === 'expense' ? (
                                                            <>
                                                                <Link
                                                                    href={`/groups/${id}/expenses/${item.id}/edit`}
                                                                    className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 transition-all border border-transparent hover:border-teal-100"
                                                                >
                                                                    <HiPencil className="w-5 h-5" />
                                                                </Link>
                                                                <button
                                                                    onClick={() => handleDeleteExpense(item as any)}
                                                                    className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                                                >
                                                                    <HiTrash className="w-5 h-5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleDeleteSettlement(item.id)}
                                                                className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                                            >
                                                                <HiTrash className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Member Spending Summary */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 italic">Member Contributions</h3>
                            {isOverallView && <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-widest">Aggregated</span>}
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {group.members.map((memberId) => {
                                // Use displayExpenses for consistency with ledger when in overall view
                                const sourceExpenses = isOverallView ? displayExpenses : expenses;
                                
                                const totalSpent = sourceExpenses
                                    .filter(e => {
                                        if (e.contributors) return e.contributors[memberId] > 0;
                                        return e.paidBy === memberId;
                                    })
                                    .reduce((sum, e) => {
                                        if (e.contributors) return sum + (e.contributors[memberId] || 0);
                                        return sum + e.amount;
                                    }, 0);
                                    
                                const totalOwed = sourceExpenses
                                    .flatMap(e => e.splits)
                                    .filter(s => s.userId === memberId)
                                    .reduce((sum, s) => sum + s.amount, 0);
                                    
                                const netBalance = totalSpent - totalOwed;

                                return (
                                    <div key={memberId} className="p-6 bg-gray-50/50 border border-gray-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="text-lg font-black text-gray-900 italic">{getUserName(memberId)}</span>
                                                {members[memberId]?.isDummy && group.createdBy === user.uid && (
                                                    <button
                                                        onClick={() => {
                                                            const link = `${window.location.origin}/guest/${memberId}`;
                                                            navigator.clipboard.writeText(link);
                                                            showToast("Guest link copied! Send it to them.", "success");
                                                        }}
                                                        className="block text-[9px] mt-1 bg-teal-50 text-teal-600 px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-teal-100 transition-colors"
                                                    >
                                                        Copy Guest Link
                                                    </button>
                                                )}
                                            </div>
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
                    {/* View Toggle (Overall vs Group) */}
                    {!group.parentId && subgroups.length > 0 && (
                        <div className="bg-white rounded-3xl p-2 border border-teal-100 flex shadow-sm">
                            <button
                                onClick={() => setIsOverallView(true)}
                                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isOverallView ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Overall Totals
                            </button>
                            <button
                                onClick={() => setIsOverallView(false)}
                                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!isOverallView ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                This Group Only
                            </button>
                        </div>
                    )}

                    {/* Sub-Activities (Nested Groups) */}
                    {!group.parentId && (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full opacity-30 -mr-8 -mt-8" />
                            <div className="flex justify-between items-center mb-6 relative z-10">
                                <h3 className="text-xl font-black text-gray-900 italic">Sub-Activities</h3>
                                <button
                                    onClick={() => setShowSubgroupModal(true)}
                                    className="p-2 bg-teal-100 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                                    title="Create Subgroup"
                                >
                                    <HiPlus className="w-4 h-4" />
                                </button>
                            </div>

                            {subgroups.length === 0 ? (
                                <div className="text-center py-6 border-2 border-dashed border-gray-50 rounded-2xl relative z-10">
                                    <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase mb-1">No nested groups</p>
                                    <p className="text-[9px] text-gray-400 font-medium">Create a subgroup for trips or events.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 relative z-10">
                                    {subgroups.map((sub) => (
                                        <Link
                                            key={sub.id}
                                            href={`/groups/${sub.id}`}
                                            className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-white border border-transparent hover:border-teal-100 hover:shadow-lg hover:shadow-teal-100/30 rounded-2xl transition-all group/sub"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm group-hover/sub:bg-teal-600 group-hover/sub:text-white transition-all">
                                                    <HiUserGroup className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 group-hover/sub:text-teal-600 transition-colors truncate">{sub.name}</p>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{sub.members.length} participants</p>
                                                </div>
                                            </div>
                                            <HiArrowRight className="w-4 h-4 text-gray-300 group-hover/sub:text-teal-500 group-hover/sub:translate-x-1 transition-all" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Persistent Personal Ledger */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative overflow-hidden">
                        {isOverallView && !group.parentId && subgroups.length > 0 && (
                            <div className="absolute top-0 right-0 p-2">
                                <span className="bg-teal-50 text-teal-600 text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg border border-teal-100">Aggregated</span>
                            </div>
                        )}
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
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Optimized to minimize transactions</p>
                        {balances.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-emerald-500 font-bold mb-1 italic">Everyone is settled!</p>
                                <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">No transactions needed</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {balances.map((balance, idx) => {
                                    const fromBalance = netBalances[balance.from] || 0;
                                    const toBalance = netBalances[balance.to] || 0;
                                    const directDebt = pairwiseLedger[balance.from]?.[balance.to] || 0;
                                    const totalUserDebt = Object.values(pairwiseLedger[user.uid] || {}).reduce((a, b) => a + b, 0);

                                    // Step 2 Logic: Find connections
                                    // If balance.amount > directDebt, it means we are routing debts from others.
                                    // Let's find who else we owe who also owes balance.to
                                    const redirectedFrom: { name: string, amount: number }[] = [];
                                    if (balance.from === user.uid && balance.amount > directDebt + 0.01) {
                                        Object.entries(pairwiseLedger[user.uid] || {}).forEach(([otherId, amt]) => {
                                            if (otherId !== balance.to && amt > 0) {
                                                const thatPersonOwesRecipient = pairwiseLedger[otherId]?.[balance.to] || 0;
                                                if (thatPersonOwesRecipient > 0) {
                                                    redirectedFrom.push({ name: getUserName(otherId), amount: Math.min(amt, thatPersonOwesRecipient) });
                                                }
                                            }
                                        });
                                    }

                                    return (
                                        <div key={idx} className="group/settle space-y-3">
                                            <Link
                                                href={`/groups/${id}/settle?payer=${balance.from}&recipient=${balance.to}&amount=${balance.amount}`}
                                                className="flex items-center justify-between p-5 bg-emerald-50/30 rounded-3xl border-2 border-emerald-100/50 group-hover/settle:bg-white group-hover/settle:border-emerald-400 group-hover/settle:shadow-xl transition-all duration-300 block"
                                            >
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span className="text-sm font-black text-gray-900 group-hover/settle:text-emerald-600 transition-colors truncate">{getUserName(balance.from)}</span>
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">payer → {getUserName(balance.to)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xl font-black text-emerald-600 italic">₹{balance.amount.toLocaleString()}</span>
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center group-hover/settle:bg-emerald-500 transition-colors">
                                                        <HiArrowRight className="w-4 h-4 text-emerald-600 group-hover/settle:text-white transition-colors" />
                                                    </div>
                                                </div>
                                            </Link>

                                            {/* Collapsible Breakdown */}
                                            <details className="group/breakdown px-2">
                                                <summary className="list-none cursor-pointer flex items-center gap-2 text-[10px] font-black text-teal-600 uppercase tracking-widest hover:text-teal-700 transition-colors">
                                                    <span className="group-open/breakdown:rotate-180 transition-transform"><HiChevronDown className="w-4 h-4" /></span>
                                                    Why these amounts?
                                                </summary>

                                                <div className="mt-4 p-6 bg-gray-50/80 rounded-[2rem] border border-gray-100 space-y-6">
                                                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
                                                        “This amount is optimized to reduce the total number of payments in the group. Your total payment stays the same, but the system redirects part of your payment through members who are owed more money.”
                                                    </p>

                                                    <div className="space-y-6">
                                                        {/* STEP 1 */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="w-5 h-5 rounded-full bg-gray-200 text-[10px] font-black flex items-center justify-center">1</span>
                                                                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Direct Debts</h4>
                                                            </div>
                                                            <div className="space-y-2 pl-7">
                                                                {balance.from === user.uid ? (
                                                                    Object.entries(pairwiseLedger[user.uid] || {}).map(([oid, amt]) => amt > 0 && (
                                                                        <div key={oid} className="flex items-center justify-between text-[11px] font-bold text-rose-500">
                                                                            <span>You → {getUserName(oid)}</span>
                                                                            <span>₹{amt.toLocaleString()}</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-[11px] font-bold text-gray-500 italic"> Ledger calculation for {getUserName(balance.from)}...</div>
                                                                )}
                                                                <div className="pt-2 border-t border-gray-200 flex justify-between text-[10px] font-black text-gray-900 uppercase">
                                                                    <span>Total Owed</span>
                                                                    <span>₹{Math.abs(fromBalance).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* STEP 2 */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="w-5 h-5 rounded-full bg-gray-200 text-[10px] font-black flex items-center justify-center">2</span>
                                                                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Group Debt Chain</h4>
                                                            </div>
                                                            <div className="pl-7 space-y-3">
                                                                {redirectedFrom.length > 0 ? (
                                                                    redirectedFrom.map((redirect, ridx) => (
                                                                        <div key={ridx} className="flex flex-col gap-1 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                                                            <div className="absolute top-0 right-0 w-1 h-full bg-teal-400 opacity-20" />
                                                                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                                                                                <span>{redirect.name} owes {getUserName(balance.to)}</span>
                                                                                <span>₹{redirect.amount.toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-[10px] font-black text-teal-600">
                                                                                <span>You</span>
                                                                                <HiArrowRight className="w-3 h-3" />
                                                                                <span>{redirect.name}</span>
                                                                                <HiArrowRight className="w-3 h-3" />
                                                                                <span className="bg-teal-50 px-2 py-0.5 rounded-md italic">Simplified</span>
                                                                                <HiArrowRight className="w-3 h-3" />
                                                                                <span>{getUserName(balance.to)}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 text-[10px] font-bold text-gray-500 italic">
                                                                        <HiInformationCircle className="w-4 h-4 text-teal-400" />
                                                                        Complex multi-person debt chain resolved.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* STEP 3 */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-emerald-200">3</span>
                                                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Optimized Settlement</h4>
                                                            </div>
                                                            <div className="pl-7 bg-emerald-50/50 p-4 rounded-2xl border-2 border-emerald-100 border-dashed">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-black text-gray-900">You → {getUserName(balance.to)}</span>
                                                                    </div>
                                                                    <span className="text-sm font-black text-emerald-600 italic">₹{balance.amount.toLocaleString()}</span>
                                                                </div>
                                                                <p className="text-[8px] text-emerald-700 font-bold uppercase tracking-[0.05em] mt-2 opacity-60">
                                                                    Final Result: Settles share of {getUserName(balance.to)}'s credit.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    );
                                })}
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
                                                onClick={() => setMemberToRemove(memberId)}
                                                className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-all border-b border-rose-100"
                                            >
                                                Remove
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
                groupName={group!.name}
            />

            {/* Edit Group Modal */}
            <EditGroupModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                group={group!}
                onConfirm={async (updatedData) => {
                    try {
                        await updateGroup(id, updatedData);
                        showToast('Circle updated!', 'success');
                        fetchData();
                    } catch (error: any) {
                        showToast(error.message || 'Failed to update circle', 'error');
                    }
                }}
            />

            {/* Remove Member Modal */}
            <AnimatePresence>
                {memberToRemove && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
                        onClick={() => setMemberToRemove(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[100px] -z-10" />

                            <div className="w-16 h-16 bg-rose-100/50 rounded-2xl flex items-center justify-center mb-6">
                                <HiTrash className="w-8 h-8 text-rose-500" />
                            </div>

                            <h3 className="text-2xl font-black text-gray-900 mb-2">Remove Member</h3>
                            <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">
                                Are you sure you want to remove <strong className="text-gray-900">{getUserName(memberToRemove!)}</strong> from {group!.name}? They will lose access to all expenses and history in this circle.
                            </p>

                            <div className="flex gap-4">
                                <Button
                                    type="button"
                                    onClick={() => setMemberToRemove(null)}
                                    className="flex-1 bg-gray-50 text-gray-600 hover:bg-gray-100 border-none"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const { removeMember } = await import('@/lib/firestore');
                                            await removeMember(id, memberToRemove, user!.uid);
                                            await fetchData();
                                            showToast('Member removed successfully', 'success');
                                            setMemberToRemove(null);
                                        } catch (error: any) {
                                            showToast(error.message || 'Failed to remove member', 'error');
                                        }
                                    }}
                                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-200"
                                >
                                    Remove
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CreateSubgroupModal
                isOpen={showSubgroupModal}
                onClose={() => setShowSubgroupModal(false)}
                parentMembers={Object.values(members)}
                onConfirm={async (name, description, selectedMemberIds) => {
                    if (!user) return;
                    if (subgroups.some(s => s.name.toLowerCase() === name.toLowerCase())) {
                        throw new Error("A sub-activity with this name already exists in this circle");
                    }
                    await createSubgroup(name, description, user.uid, id, selectedMemberIds);
                    showToast('Sub-activity created!', 'success');
                    router.refresh();
                    fetchData();
                }}
            />

            <ExportReportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                group={group!}
                expenses={expenses}
                settlements={settlements}
                members={members}
            />

            {/* Floating Action Button & Menu */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end md:hidden">
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="mb-4 bg-white/90 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-3xl p-3 flex flex-col gap-2 w-56 md:w-64 origin-bottom-right"
                        >
                            <Link href={`/groups/${id}/expenses/new`} onClick={() => setIsMenuOpen(false)}>
                                <div className="flex items-center gap-3 w-full p-3 rounded-2xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer group">
                                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                                        <HiPlus className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-sm">Add Expense</span>
                                </div>
                            </Link>

                            <Link href={`/groups/${id}/settle`} onClick={() => setIsMenuOpen(false)}>
                                <div className="flex items-center gap-3 w-full p-3 rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer group">
                                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                                        <HiCurrencyRupee className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-sm">Settle Up</span>
                                </div>
                            </Link>

                            {!group.parentId && (
                                <button
                                    onClick={() => { setShowSubgroupModal(true); setIsMenuOpen(false); }}
                                    className="flex items-center gap-3 w-full p-3 rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer group"
                                >
                                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                                        <HiUserGroup className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-sm">Create Subgroup</span>
                                </button>
                            )}

                            <div className="h-px bg-gray-100 my-1 mx-2" />

                            <button
                                onClick={() => { setShowAddMember(!showAddMember); setIsMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-gray-50 text-gray-700 transition-colors text-left group"
                            >
                                <div className="p-2 bg-gray-100 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <HiUserAdd className="w-5 h-5 text-gray-500" />
                                </div>
                                <span className="font-bold text-sm">Invite Member</span>
                            </button>

                            <button
                                onClick={() => { setIsExportModalOpen(true); setIsMenuOpen(false); }}
                                className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-gray-50 text-gray-700 transition-colors text-left group"
                            >
                                <div className="p-2 bg-gray-100 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <HiDownload className="w-5 h-5 text-gray-500" />
                                </div>
                                <span className="font-bold text-sm">Export Data</span>
                            </button>

                            <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                                <div className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer group">
                                    <div className="p-2 bg-gray-100 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                                        <HiHome className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <span className="font-bold text-sm">Dashboard</span>
                                </div>
                            </Link>

                            {user?.uid === group.createdBy && (
                                <>
                                    <div className="h-px bg-gray-100 my-1 mx-2" />
                                    <button
                                        onClick={() => { setShowDeleteModal(true); setIsMenuOpen(false); }}
                                        className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-rose-50 text-rose-600 transition-colors text-left group"
                                    >
                                        <div className="p-2 bg-rose-100/50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                                            <HiTrash className="w-5 h-5 text-rose-500" />
                                        </div>
                                        <span className="font-bold text-sm">Delete Group</span>
                                    </button>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FAB Overlay Background to capture outside clicks */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[-1] bg-black/5 backdrop-blur-[2px]"
                            onClick={() => setIsMenuOpen(false)}
                        />
                    )}
                </AnimatePresence>



                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="w-16 h-16 bg-[#030508] text-white rounded-[2rem] shadow-xl shadow-black/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group border border-gray-800"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <motion.div
                        animate={{ rotate: isMenuOpen ? 45 : 0 }}
                        transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 15 }}
                    >
                        <HiPlus className="w-8 h-8" />
                    </motion.div>
                </button>
            </div>
        </div >
    );
}
