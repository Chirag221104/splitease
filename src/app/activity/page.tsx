"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserActivities, getUsersByIds } from "@/lib/firestore";
import { Activity, User } from "@/types";
import { format } from "date-fns";
import { HiCurrencyDollar, HiUserGroup, HiMail, HiCheckCircle } from "react-icons/hi";

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

                // Fetch user details for all involved users
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
        switch (type) {
            case 'expense': return <HiCurrencyDollar className="w-5 h-5 text-teal-600" />;
            case 'group_created': return <HiUserGroup className="w-5 h-5 text-blue-600" />;
            case 'invite_accepted': return <HiMail className="w-5 h-5 text-green-600" />;
            case 'settle': return <HiCheckCircle className="w-5 h-5 text-purple-600" />;
        }
    };

    if (loading) return <div className="p-4">Loading activity...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {activities.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No recent activity
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {activities.map((activity) => (
                            <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-medium">{getUserName(activity.userId)}</span>
                                            {' '}{activity.description}
                                        </p>
                                        {activity.amount && (
                                            <p className="text-sm font-bold text-teal-600 mt-1">
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
                                                return format(dateObj, 'PPp');
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
