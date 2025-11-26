"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { acceptInvite, getInvite } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

function InviteConfirmContent() {
    const searchParams = useSearchParams();
    const inviteId = searchParams.get("id");
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState("Processing invite...");

    useEffect(() => {
        const processInvite = async () => {
            if (authLoading) return;

            if (!user) {
                setStatus('error');
                setMessage("Please log in to accept this invite.");
                return;
            }

            if (!inviteId) {
                setStatus('error');
                setMessage("Invalid invite link.");
                return;
            }

            try {
                // First check if invite exists and is valid
                const invite = await getInvite(inviteId);
                if (!invite) {
                    setStatus('error');
                    setMessage("Invite not found.");
                    return;
                }

                if (invite.status !== 'pending') {
                    setStatus('error');
                    setMessage("This invite has already been used.");
                    return;
                }

                // Accept invite
                await acceptInvite(inviteId, user);
                setStatus('success');
                setMessage("Invite accepted! Redirecting to group...");

                // Redirect after a short delay
                setTimeout(() => {
                    router.push(`/groups/${invite.groupId}`);
                }, 2000);

            } catch (error: any) {
                console.error("Error accepting invite:", error);
                setStatus('error');
                setMessage(error.message || "Failed to accept invite.");
            }
        };

        processInvite();
    }, [user, authLoading, inviteId, router]);

    if (authLoading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Login Required</h2>
                <p className="text-gray-600 mb-6">You need to be logged in to accept this invite.</p>
                <div className="space-y-3">
                    <Link href={`/login?redirect=/invite/confirm?id=${inviteId}`}>
                        <Button className="w-full">Log In</Button>
                    </Link>
                    <Link href={`/register?redirect=/invite/confirm?id=${inviteId}`}>
                        <Button variant="outline" className="w-full">Sign Up</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
            {status === 'loading' && (
                <div>
                    <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">{message}</p>
                </div>
            )}

            {status === 'success' && (
                <div>
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Success!</h2>
                    <p className="text-gray-600">{message}</p>
                </div>
            )}

            {status === 'error' && (
                <div>
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
                    <p className="text-gray-600 mb-6">{message}</p>
                    <Link href="/dashboard">
                        <Button variant="outline">Go to Dashboard</Button>
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function InviteConfirmPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <InviteConfirmContent />
        </Suspense>
    );
}
