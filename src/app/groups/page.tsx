"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserGroups } from "@/lib/firestore";
import { Group } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HiPlus, HiUserGroup } from "react-icons/hi";

import { motion } from "framer-motion";

const GroupAvatar = ({ name }: { name: string }) => {
    const colors = [
        'bg-rose-100 text-rose-600',
        'bg-teal-100 text-teal-600',
        'bg-amber-100 text-amber-600',
        'bg-indigo-100 text-indigo-600',
        'bg-emerald-100 text-emerald-600',
        'bg-blue-100 text-blue-600',
    ];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const colorClass = colors[charCodeSum % colors.length];

    return (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${colorClass}`}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
};

export default function GroupsPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGroups = async () => {
            if (!user) return;
            try {
                const userGroups = await getUserGroups(user.uid);
                setGroups(userGroups);
            } catch (error) {
                console.error("Error fetching groups:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
    }, [user]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
    );

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-12">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Groups</h1>
                    <p className="text-gray-500 mt-1">Track and split expenses with your friends</p>
                </div>
                <Link href="/groups/create">
                    <Button className="flex items-center gap-2 px-6 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                        <HiPlus className="w-5 h-5" />
                        Create New Group
                    </Button>
                </Link>
            </header>

            {groups.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"
                >
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <HiUserGroup className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">No groups found</h3>
                    <p className="mt-2 text-gray-500 max-w-xs mx-auto">You haven't joined any groups yet. Start by creating one!</p>
                    <div className="mt-8">
                        <Link href="/groups/create">
                            <Button size="lg" className="rounded-xl px-8">Create your first group</Button>
                        </Link>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                    {groups.map((group, index) => (
                        <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                href={`/groups/${group.id}`}
                                className="group block bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:border-teal-100 transition-all duration-300 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <HiUserGroup className="h-20 w-20" />
                                </div>

                                <div className="flex items-center gap-5">
                                    <GroupAvatar name={group.name} />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors truncate">
                                            {group.name}
                                        </h3>
                                        {group.description ? (
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{group.description}</p>
                                        ) : (
                                            <p className="text-sm text-gray-400 mt-1 italic">No description</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <div className="flex -space-x-2">
                                            {group.members.slice(0, 3).map((_, i) => (
                                                <div key={i} className={`w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400`}>
                                                    U
                                                </div>
                                            ))}
                                            {group.members.length > 3 && (
                                                <div className="w-8 h-8 rounded-full border-2 border-white bg-teal-50 flex items-center justify-center text-[10px] font-bold text-teal-600">
                                                    +{group.members.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <span className="ml-2">{group.members.length} members</span>
                                    </div>
                                    <span className="text-teal-600 font-semibold text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                        View details →
                                    </span>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
