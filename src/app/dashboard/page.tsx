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

                // Fetch recent activities
                const userActivities = await getUserActivities(user.uid, 10);
                setActivities(userActivities);

                // Fetch user details for activities
                const userIds = [...new Set(userActivities.map(a => a.userId))];
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
        switch (type) {
            case 'expense': return <HiCurrencyDollar className="w-5 h-5 text-teal-600" />;
            case 'group_created': return <HiUserGroup className="w-5 h-5 text-blue-600" />;
            case 'invite_accepted': return <HiMail className="w-5 h-5 text-green-600" />;
            case 'settle': return <HiCheckCircle className="w-5 h-5 text-purple-600" />;
        }
    };

    if (loading) {
        return <div className="p-4">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <Link href="/groups/create">
                    <Button className="flex items-center gap-2">
                        <HiPlus className="w-5 h-5" />
                        Create Group
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">you are owed</h3>
                    <p className="mt-2 text-3xl font-bold text-teal-600">
                        ₹{totalOwed.toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                        across all groups
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">you owe</h3>
                    <p className="mt-2 text-3xl font-bold text-red-500">
                        ₹{totalOwes.toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                        across all groups
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Your Groups</h3>
                        <Link href="/groups" className="text-sm text-teal-600 hover:text-teal-700">
                            View all
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {groups.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                You haven't joined any groups yet.
                            </div>
                        ) : (
                            groups.map((group) => (
                                <Link
                                    key={group.id}
                                    href={`/groups/${group.id}`}
                                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-gray-900">{group.name}</p>
                                            {group.description && (
                                                <p className="text-sm text-gray-500">{group.description}</p>
                                            )}
                                        </div>
                                        <span className="text-gray-400 text-sm">
                                            {group.members.length} members
                                        </span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {activities.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">
                                Start adding expenses to see activity here.
                            </div>
                        ) : (
                            activities.map((activity) => (
                                <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900">
                                                <span className="font-medium">{getUserName(activity.userId)}</span>
                                                {' '}{activity.description}
                                            </p>
                                            {activity.amount && (
                                                <p className="text-xs font-bold text-teal-600 mt-1">
                                                    ₹{activity.amount.toFixed(2)}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {(() => {
                                                    const dateVal = activity.createdAt;
                                                    let dateObj: Date;
                                                    if (typeof dateVal === 'number') {
                                                        dateObj = new Date(dateVal);
                                                    } else if (dateVal && typeof (dateVal as any).toDate === 'function') {
                                                        dateObj = (dateVal as any).toDate();
                                                    } else {
                                                        dateObj = new Date();
                                                    }
                                                    return format(dateObj, 'MMM dd, h:mm a');
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
