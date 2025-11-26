"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push("/login");
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
