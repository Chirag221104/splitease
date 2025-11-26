"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { checkUsernameAvailability, updateUserUsername } from "@/lib/firestore";
import { validateUsername } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function UsernameSetupModal() {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const [username, setUsername] = useState("");
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(false);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Only show if user exists and doesn't have a username
        if (user && !user.username) {
            setShow(true);
        } else {
            setShow(false);
        }
    }, [user]);

    const handleCheck = async () => {
        setError("");
        const validation = validateUsername(username);

        if (!validation.valid) {
            setError(validation.error || "Invalid username");
            return;
        }

        setChecking(true);
        try {
            const available = await checkUsernameAvailability(username);
            if (!available) {
                setError("This username is already taken");
            }
        } catch (err) {
            setError("Failed to check availability");
        } finally {
            setChecking(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError("");
        setLoading(true);

        try {
            await updateUserUsername(user.uid, username);
            // Refresh user data from Firestore
            await refreshUser();
            showToast(`Username set to @${username}`, 'success');
            // Modal will auto-close via useEffect when user.username is set
        } catch (err: any) {
            setError(err.message || "Failed to set username");
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 space-y-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Choose Your Username</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        You need a username to continue using SplitEase
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Input
                            label="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            onBlur={handleCheck}
                            placeholder="username_here"
                            required
                            error={error}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Lowercase letters, numbers, underscore, and period only
                        </p>
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        isLoading={loading || checking}
                        disabled={!!error || !username}
                    >
                        Set Username
                    </Button>
                </form>
            </div>
        </div>
    );
}
