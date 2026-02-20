"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset email sent! Check your inbox — and your spam folder if you don't see it.");
        } catch (err: any) {
            setError(err.message || "Failed to send reset email.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-900">
                    Reset Password
                </h2>

                <p className="text-sm text-center text-gray-600">
                    Enter your email and we'll send you a reset link
                </p>

                <form onSubmit={handleReset} className="space-y-4">
                    <Input
                        label="Email address"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                    />

                    {message && (
                        <p className="text-green-600 text-sm text-center">{message}</p>
                    )}
                    {error && (
                        <p className="text-red-600 text-sm text-center">{error}</p>
                    )}

                    <Button className="w-full" isLoading={loading} type="submit">
                        Send Reset Link
                    </Button>
                </form>

                <p className="text-sm text-center text-gray-600">
                    Back to{" "}
                    <Link href="/login" className="text-teal-600 hover:text-teal-500 font-medium">
                        Login
                    </Link>
                </p>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-gray-500">Or</span>
                    </div>
                </div>

                <p className="text-sm text-center text-gray-600">
                    <Link href="/reset/phone" className="text-teal-600 hover:text-teal-500 font-medium">
                        Reset with phone number
                    </Link>
                </p>
            </div>
        </div>
    );
}
