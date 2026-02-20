"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByPhone } from "@/lib/firestore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function ResetWithPhonePage() {
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Validate phone number format (basic validation)
            if (!phone.startsWith("+")) {
                setError("Phone number must be in international format (e.g., +911234567890)");
                setLoading(false);
                return;
            }

            // Check if phone number exists in Firestore
            const user = await getUserByPhone(phone);
            if (!user) {
                setError("This phone number isn't linked to any account.");
                setLoading(false);
                return;
            }

            // Set up reCAPTCHA verifier
            if (!(window as any).recaptchaVerifier) {
                (window as any).recaptchaVerifier = new RecaptchaVerifier(
                    auth,
                    "recaptcha-container",
                    {
                        size: "invisible"
                    }
                );
            }



            const appVerifier = (window as any).recaptchaVerifier;

            // Send OTP
            const confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);

            // Store confirmation result in session storage
            sessionStorage.setItem("phoneConfirmation", JSON.stringify({
                phone: phone,
                timestamp: Date.now()
            }));
            (window as any).confirmationResult = confirmationResult;

            // Navigate to verify page
            router.push(`/reset/phone/verify?phone=${encodeURIComponent(phone)}`);
        } catch (err: any) {
            console.error("Error sending OTP:", err);
            if (err.code === "auth/invalid-phone-number") {
                setError("Invalid phone number format.");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many requests. Please try again later.");
            } else {
                setError(err.message || "Failed to send OTP. Please try again.");
            }

            // Reset reCAPTCHA on error
            if ((window as any).recaptchaVerifier) {
                const verifier = (window as any).recaptchaVerifier;
                if (verifier) {
                    verifier.clear();
                    (window as any).recaptchaVerifier = null;
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-900">
                    Reset Password with Phone
                </h2>

                <p className="text-sm text-center text-gray-600">
                    Enter your registered phone number and we'll send you an OTP
                </p>

                <form onSubmit={handleSendOTP} className="space-y-4">
                    <Input
                        label="Phone Number"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+911234567890"
                    />

                    <p className="text-xs text-gray-500">
                        Use international format with country code (e.g., +91 for India)
                    </p>

                    {error && (
                        <p className="text-red-600 text-sm text-center">{error}</p>
                    )}

                    <Button className="w-full" isLoading={loading} type="submit">
                        Send OTP
                    </Button>

                    {/* Invisible reCAPTCHA container */}
                    <div id="recaptcha-container"></div>
                </form>

                <div className="space-y-2">
                    <p className="text-sm text-center text-gray-600">
                        Remember your password?{" "}
                        <Link href="/login" className="text-teal-600 hover:text-teal-500 font-medium">
                            Login
                        </Link>
                    </p>
                    <p className="text-sm text-center text-gray-600">
                        Or{" "}
                        <Link href="/forgot-password" className="text-teal-600 hover:text-teal-500 font-medium">
                            Reset with Email
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
