"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { updateUserPhone } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SettingsPage() {
    const { user, logout, refreshUser } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phone, setPhone] = useState("");
    const [currentPhone, setCurrentPhone] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUserPhone = async () => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentPhone(userData.phone || "");
                    setPhone(userData.phone || "");
                }
            } catch (error) {
                console.error("Error fetching user phone:", error);
            }
        };

        fetchUserPhone();
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const handleUpdatePhone = async () => {
        if (!user) return;

        // Basic validation
        if (phone && !phone.startsWith("+")) {
            showToast("Phone number must be in international format (e.g., +911234567890)", "error");
            return;
        }

        setLoading(true);
        try {
            await updateUserPhone(user.uid, phone);
            await refreshUser();
            setCurrentPhone(phone);
            setIsEditingPhone(false);
            showToast("Phone number updated successfully!", "success");
        } catch (error: any) {
            showToast(error.message || "Failed to update phone number", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setPhone(currentPhone);
        setIsEditingPhone(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Account</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="mt-1 text-gray-900">{user?.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Display Name</label>
                            <p className="mt-1 text-gray-900">{user?.displayName || "Not set"}</p>
                        </div>

                        {/* Phone Number Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Phone Number
                                </label>
                                {!isEditingPhone && (
                                    <button
                                        onClick={() => setIsEditingPhone(true)}
                                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                                    >
                                        {currentPhone ? "Edit" : "Add"}
                                    </button>
                                )}
                            </div>

                            {isEditingPhone ? (
                                <div className="space-y-3">
                                    <Input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+911234567890"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Use international format with country code (e.g., +91 for India)
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleUpdatePhone}
                                            isLoading={loading}
                                            size="sm"
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            onClick={handleCancelEdit}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-1 text-gray-900">
                                    {currentPhone || "Not set"}
                                </p>
                            )}

                            {currentPhone && !isEditingPhone && (
                                <p className="mt-2 text-xs text-gray-500">
                                    You can use this phone number for OTP-based password reset
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                        Log Out
                    </Button>
                </div>
            </div>
        </div>
    );
}
