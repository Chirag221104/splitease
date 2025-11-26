"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createGroup, createInvite } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiPlus, HiX } from "react-icons/hi";

export default function CreateGroupPage() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [inviteEmails, setInviteEmails] = useState<string[]>([]);
    const [currentEmail, setCurrentEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuth();
    const router = useRouter();

    const handleAddEmail = () => {
        if (currentEmail && !inviteEmails.includes(currentEmail)) {
            setInviteEmails([...inviteEmails, currentEmail]);
            setCurrentEmail("");
        }
    };

    const handleRemoveEmail = (email: string) => {
        setInviteEmails(inviteEmails.filter(e => e !== email));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError("");

        try {
            const groupId = await createGroup(name, description, user.uid);

            // Create invites
            if (inviteEmails.length > 0) {
                await Promise.all(inviteEmails.map(email =>
                    createInvite(groupId, email, user.uid)
                ));
            }

            router.push(`/groups/${groupId}`);
        } catch (err: any) {
            setError("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a Group</h1>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Group Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Trip to Goa, Office Lunches"
                        required
                    />

                    <Input
                        label="Description (Optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this group for?"
                    />

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Invite Members (Optional)</label>
                        <div className="flex gap-2">
                            <Input
                                value={currentEmail}
                                onChange={(e) => setCurrentEmail(e.target.value)}
                                placeholder="Enter email address"
                                type="email"
                                className="flex-1"
                            />
                            <Button type="button" variant="outline" onClick={handleAddEmail}>
                                <HiPlus className="w-5 h-5" />
                            </Button>
                        </div>

                        {inviteEmails.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {inviteEmails.map(email => (
                                    <div key={email} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                        {email}
                                        <button type="button" onClick={() => handleRemoveEmail(email)} className="text-gray-500 hover:text-red-500">
                                            <HiX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            isLoading={loading}
                        >
                            Create Group
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
