"use client";

import { useState } from "react";
import { createInvite } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";

interface AddMemberFormProps {
    groupId: string;
    onMemberAdded: () => void;
}

export function AddMemberForm({ groupId, onMemberAdded }: AddMemberFormProps) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            await createInvite(groupId, email, user.uid);
            setSuccess("Invite sent successfully!");
            setEmail("");
            onMemberAdded();
        } catch (err: any) {
            setError(err.message || "Failed to send invite.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Invite using email or username"
                    required
                    className="flex-1"
                />
                <Button type="submit" isLoading={loading}>
                    Add
                </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">{success}</p>}
        </form>
    );
}
