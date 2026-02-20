"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserGroups, getGroupExpenses, getGroupSettlements, getUserActivities, getUsersByIds } from "@/lib/firestore";
import { calculateGroupBalances, calculateGlobalBalances } from "@/lib/calculations";
import { Group, Activity, User } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HiPlus, HiCurrencyDollar, HiUserGroup, HiMail, HiCheckCircle } from "react-icons/hi";
import { format } from "date-fns";
import { motion } from "framer-motion";

const StatCard = ({ label, value, subtext, icon, colorClass, delay = 0 }: { label: string, value: string, subtext: string, icon: any, colorClass: string, delay?: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex-1 group hover:shadow-xl transition-all duration-300 relative overflow-hidden"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-5 -mr-4 -mt-4 transition-transform group-hover:scale-110 ${colorClass.split(' ')[0]}`}></div>
        <div className="flex items-center gap-6 relative z-10">
            <div className={`p-4 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                <p className={`text-3xl font-black ${colorClass.split(' ')[1].replace('text-', 'text-gray-900')}`}>{value}</p>
                <p className="text-xs text-gray-400 font-medium mt-1">{subtext}</p>
            </div>
        </div>
    </motion.div>
);

export default function DashboardPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [members, setMembers] = useState<Record<string, User>>({});
    const [totalOwed, setTotalOwed] = useState(0);
    const [totalOwes, setTotalOwes] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            try {
                const userGroups = await getUserGroups(user.uid);
                setGroups(userGroups);

                const allGroupBalances = [];
                for (const group of userGroups) {
                    const expenses = await getGroupExpenses(group.id);
                    const settlements = await getGroupSettlements(group.id);
                    const balances = calculateGroupBalances(expenses, settlements, group.members);
                    allGroupBalances.push(balances);
                }

                const globalBalances = calculateGlobalBalances(allGroupBalances, user.uid);
                setTotalOwed(globalBalances.owed);
                setTotalOwes(globalBalances.owe);

                const userActivities = await getUserActivities(user.uid, 5);
                setActivities(userActivities);

                const userIds = [...new Set(userActivities.map(a => a.userId))].filter(Boolean);
                if (userIds.length > 0) {
                    const users = await getUsersByIds(userIds);
                    const usersMap = users.reduce((acc, u) => {
                        acc[u.uid] = u;
                        return acc;
                    }, {} as Record<string, User>);
                    setMembers(usersMap);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const getUserName = (uid: string) => {
        if (uid === user?.uid) return "You";
        return members[uid]?.displayName || members[uid]?.email || "Unknown User";
    };

    const getActivityIcon = (type: Activity['type']) => {
        const iconClasses = "w-5 h-5";
        switch (type) {
            case 'expense': return <HiCurrencyDollar className={iconClasses} />;
            case 'group_created': return <HiUserGroup className={iconClasses} />;
            case 'invite_accepted': return <HiMail className={iconClasses} />;
            case 'settle': return <HiCheckCircle className={iconClasses} />;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
    );

    return (
        <div className="space-y-10 max-w-6xl mx-auto pb-12">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">
                        Skyline <span className="text-teal-600 text-2xl not-italic font-black ml-1">v.1</span>
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Welcome back, {user?.displayName || "Member"}</p>
                </motion.div>
                <Link href="/groups/create">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <Button className="flex items-center gap-2 px-8 py-6 rounded-2xl shadow-xl shadow-teal-100 hover:shadow-2xl transition-all duration-300">
                            <HiPlus className="w-6 h-6" />
                            Create New Group
                        </Button>
                    </motion.div>
                </Link>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <StatCard
                    label="You are owed"
                    value={`₹${totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtext="across all your active groups"
                    icon={<HiCurrencyDollar className="w-8 h-8" />}
                    colorClass="bg-teal-50 text-teal-600"
                    delay={0.1}
                />
                <StatCard
                    label="You owe"
                    value={`₹${totalOwes.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtext="settle up soon to stay balanced"
                    icon={<HiCheckCircle className="w-8 h-8" />}
                    colorClass="bg-rose-50 text-rose-500"
                    delay={0.2}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Groups Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-gray-900 italic">Your Circles</h3>
                        <Link href="/groups" className="text-sm font-black text-teal-600 uppercase tracking-widest hover:text-teal-700 transition-colors">
                            View All Groups
                        </Link>
                    </div>
                    <div className="grid gap-4">
                        {groups.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center">
                                <p className="text-gray-400 font-medium">No groups yet. Start sharing!</p>
                            </div>
                        ) : (
                            groups.slice(0, 4).map((group, idx) => (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 + 0.3 }}
                                >
                                    <Link
                                        href={`/groups/${group.id}`}
                                        className="flex items-center justify-between p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-teal-50 transition-all group"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 font-black group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                                                {group.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition-colors">{group.name}</p>
                                                <p className="text-xs text-gray-500 font-medium italic mt-0.5">{group.members.length} members involved</p>
                                            </div>
                                        </div>
                                        <div className="text-gray-300 group-hover:text-teal-400 group-hover:translate-x-1 transition-all">
                                            →
                                        </div>
                                    </Link>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Section */}
                <div className="space-y-6">
                    <div className="px-2">
                        <h3 className="text-xl font-black text-gray-900 italic">Pulse Feed</h3>
                    </div>
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                        {activities.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 font-medium italic">
                                Static for now. Add an expense!
                            </div>
                        ) : (
                            activities.map((activity, idx) => {
                                const activityLink = activity.groupId ? `/groups/${activity.groupId}` : '#';
                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 + 0.4 }}
                                    >
                                        <Link
                                            href={activityLink}
                                            className="p-6 hover:bg-gray-50/50 transition-colors group flex items-start gap-5 block blur-none"
                                        >
                                            <div className="mt-1 p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-600 leading-relaxed">
                                                    <span className="font-black text-gray-900 italic">{getUserName(activity.userId)}</span>
                                                    {' '}{activity.description}
                                                </p>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                                        {(() => {
                                                            const dateVal = activity.createdAt;
                                                            let dateObj: Date;
                                                            if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                            else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                            else dateObj = new Date();
                                                            return format(dateObj, 'MMM dd, h:mm a');
                                                        })()}
                                                    </span>
                                                    {activity.amount && (
                                                        <span className="text-sm font-black text-teal-600">
                                                            <span className="text-teal-500 mr-0.5">₹</span>{activity.amount.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-1 text-gray-200 group-hover:text-teal-400 transition-colors">
                                                <HiPlus className="w-4 h-4 rotate-45 transform" />
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
