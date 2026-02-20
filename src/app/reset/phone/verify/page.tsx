"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

function VerifyOTPContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const phoneParam = searchParams.get("phone");
        if (phoneParam) {
            setPhone(decodeURIComponent(phoneParam));
        }

        // Verify we have the confirmation result
        const storedData = sessionStorage.getItem("phoneConfirmation");
        if (!storedData || !(window as any).confirmationResult) {
            setError("Session expired. Please request a new OTP.");
        }
    }, [searchParams]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            // Validate inputs
            if (otp.length !== 6) {
                setError("OTP must be 6 digits");
                setLoading(false);
                return;
            }

            if (newPassword.length < 6) {
                setError("Password must be at least 6 characters");
                setLoading(false);
                return;
            }

            if (newPassword !== confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }

            // Get confirmation result
            const confirmationResult = (window as any).confirmationResult;
            if (!confirmationResult) {
                setError("Session expired. Please request a new OTP.");
                setLoading(false);
                return;
            }

            // Verify OTP (this logs the user in temporarily)
            await confirmationResult.confirm(otp);

            // Update password
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError("Authentication failed. Please try again.");
                setLoading(false);
                return;
            }

            await updatePassword(currentUser, newPassword);

            // Clear session storage
            sessionStorage.removeItem("phoneConfirmation");
            (window as any).confirmationResult = null;

            // Show success message
            setSuccess("Password updated successfully! Redirecting to login...");

            // Sign out the user after password reset
            await auth.signOut();

            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push("/login");
            }, 2000);

        } catch (err: any) {
            console.error("Error verifying OTP:", err);
            if (err.code === "auth/invalid-verification-code") {
                setError("Invalid OTP code. Please try again.");
            } else if (err.code === "auth/code-expired") {
                setError("OTP has expired. Please request a new one.");
            } else if (err.code === "auth/weak-password") {
                setError("Password is too weak. Use at least 6 characters.");
            } else {
                setError(err.message || "Failed to reset password. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRequestNewOTP = () => {
        sessionStorage.removeItem("phoneConfirmation");
        (window as any).confirmationResult = null;
        router.push("/reset/phone");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-900">
                    Verify OTP & Reset Password
                </h2>

                <p className="text-sm text-center text-gray-600">
                    We sent a code to {phone}
                </p>

                <form onSubmit={handleResetPassword} className="space-y-4">
                    <Input
                        label="OTP Code"
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                    />

                    <Input
                        label="New Password"
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                    />

                    <Input
                        label="Confirm Password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                    />

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-3 rounded-md">
                            {success}
                        </div>
                    )}

                    <Button className="w-full" isLoading={loading} type="submit">
                        Reset Password
                    </Button>
                </form>

                <div className="space-y-2">
                    <button
                        onClick={handleRequestNewOTP}
                        className="w-full text-sm text-teal-600 hover:text-teal-500 font-medium"
                    >
                        Didn't receive OTP? Request new one
                    </button>
                    <p className="text-sm text-center text-gray-600">
                        Back to{" "}
                        <Link href="/login" className="text-teal-600 hover:text-teal-500 font-medium">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function VerifyOTPPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-600">Loading...</p>
            </div>
        }>
            <VerifyOTPContent />
        </Suspense>
    );
}
