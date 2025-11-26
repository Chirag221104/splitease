"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserGroups } from "@/lib/firestore";
import { Group } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HiPlus, HiUserGroup } from "react-icons/hi";

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

    if (loading) return <div className="p-4">Loading groups...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
                <Link href="/groups/create">
                    <Button className="flex items-center gap-2">
                        <HiPlus className="w-5 h-5" />
                        Create Group
                    </Button>
                </Link>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <HiUserGroup className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No groups yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new group.</p>
                    <div className="mt-6">
                        <Link href="/groups/create">
                            <Button>Create Group</Button>
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Link
                            key={group.id}
                            href={`/groups/${group.id}`}
                            className="block bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                                    {group.description && (
                                        <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                                    )}
                                </div>
                                <HiUserGroup className="h-6 w-6 text-teal-500" />
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-500">
                                <span>{group.members.length} members</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
