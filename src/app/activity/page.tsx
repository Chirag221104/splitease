"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserActivities, getUsersByIds } from "@/lib/firestore";
import { Activity, User } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import { HiCurrencyDollar, HiUserGroup, HiMail, HiCheckCircle } from "react-icons/hi";

import { motion } from "framer-motion";
import { isToday, isYesterday } from "date-fns";

export default function ActivityPage() {
    const { user } = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [members, setMembers] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            if (!user) return;
            try {
                const userActivities = await getUserActivities(user.uid);
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
                console.error("Error fetching activities:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, [user]);

    const getUserName = (uid: string) => {
        if (uid === user?.uid) return "You";
        return members[uid]?.displayName || members[uid]?.email || "Unknown User";
    };

    const getActivityIcon = (type: Activity['type']) => {
        const iconClasses = "w-6 h-6";
        switch (type) {
            case 'expense':
                return (
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl shadow-sm border border-teal-100/50">
                        <HiCurrencyDollar className={iconClasses} />
                    </div>
                );
            case 'group_created':
                return (
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100/50">
                        <HiUserGroup className={iconClasses} />
                    </div>
                );
            case 'invite_accepted':
                return (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100/50">
                        <HiMail className={iconClasses} />
                    </div>
                );
            case 'settle':
                return (
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl shadow-sm border border-violet-100/50">
                        <HiCheckCircle className={iconClasses} />
                    </div>
                );
            default:
                return (
                    <div className="p-3 bg-gray-50 text-gray-600 rounded-2xl shadow-sm border border-gray-100/50">
                        <HiCurrencyDollar className={iconClasses} />
                    </div>
                );
        }
    };

    const groupActivitiesByDate = (acts: Activity[]) => {
        const groups: { title: string; items: Activity[] }[] = [];

        acts.forEach(act => {
            const dateVal = act.createdAt;
            let dateObj: Date;
            if (typeof dateVal === 'number') {
                dateObj = new Date(dateVal);
            } else if (dateVal && typeof (dateVal as any).toDate === 'function') {
                dateObj = (dateVal as any).toDate();
            } else {
                dateObj = new Date();
            }

            let title = "Older";
            if (isToday(dateObj)) title = "Today";
            else if (isYesterday(dateObj)) title = "Yesterday";
            else title = format(dateObj, 'MMMM dd, yyyy');

            const existingGroup = groups.find(g => g.title === title);
            if (existingGroup) {
                existingGroup.items.push(act);
            } else {
                groups.push({ title, items: [act] });
            }
        });

        return groups;
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
    );

    const groupedActivities = groupActivitiesByDate(activities);

    return (
        <div className="max-w-3xl mx-auto space-y-10 pb-12">
            <header>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Recent Activity</h1>
                <p className="text-gray-500 mt-1">Stay updated with your shared expenses</p>
            </header>

            {activities.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"
                >
                    <p className="text-gray-400 font-medium">No activity yet. Your transactions will appear here.</p>
                </motion.div>
            ) : (
                <div className="space-y-12">
                    {groupedActivities.map((group, groupIdx) => (
                        <div key={group.title} className="space-y-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                {group.title}
                            </h2>
                            <div className="space-y-4">
                                {group.items.map((activity, idx) => (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: (groupIdx * 2 + idx) * 0.03 }}
                                    >
                                        <Link
                                            href={activity.groupId ? `/groups/${activity.groupId}` : '#'}
                                            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5 group block"
                                        >
                                            <div className="flex-shrink-0 transition-transform group-hover:scale-105 duration-300">
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                                                    <p className="text-gray-700 leading-relaxed">
                                                        <span className="font-bold text-gray-900">{getUserName(activity.userId)}</span>
                                                        {' '}{activity.description}
                                                    </p>
                                                    <p className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                                                        {(() => {
                                                            const dateVal = activity.createdAt;
                                                            let dateObj: Date;
                                                            if (typeof dateVal === 'number') dateObj = new Date(dateVal);
                                                            else if (dateVal && typeof (dateVal as any).toDate === 'function') dateObj = (dateVal as any).toDate();
                                                            else dateObj = new Date();
                                                            return format(dateObj, 'h:mm a');
                                                        })()}
                                                    </p>
                                                </div>
                                                {activity.amount && (
                                                    <p className="text-lg font-black text-teal-600 mt-1">
                                                        <span className="text-teal-500 mr-0.5 font-medium">₹</span>{activity.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-teal-400 group-hover:bg-teal-50 transition-all">
                                                    →
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
