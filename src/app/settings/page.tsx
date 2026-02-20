"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

import { motion } from "framer-motion";
import { HiUser, HiMail, HiOutlineLogout, HiChevronRight } from "react-icons/hi";

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const userInitials = user?.displayName
        ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
        : user?.email?.charAt(0).toUpperCase() || 'U';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8 pb-12"
        >
            <header>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
                <p className="text-gray-500 mt-1">Manage your account preferences</p>
            </header>

            {/* Profile Header Card */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full opacity-50 -mr-8 -mt-8 animate-pulse"></div>

                <div className="w-24 h-24 bg-teal-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-teal-100 shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                    {userInitials}
                </div>

                <div className="text-center sm:text-left z-10">
                    <h2 className="text-2xl font-black text-gray-900">{user?.displayName || "New User"}</h2>
                    <p className="text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-1">
                        <HiMail className="w-4 h-4" />
                        {user?.email}
                    </p>
                    <div className="mt-4 inline-flex items-center px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full border border-teal-100">
                        Pro Account
                    </div>
                </div>
            </div>

            {/* Settings Sections */}
            <div className="space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                    <div className="p-6 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                                    <HiUser className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 italic">Personal Info</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Edit your name and avatar</p>
                                </div>
                            </div>
                            <HiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 transition-colors" />
                        </div>
                    </div>

                    <div className="p-6 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                                    <HiMail className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 italic">Email Notifications</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Control how we message you</p>
                                </div>
                            </div>
                            <HiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 transition-colors" />
                        </div>
                    </div>
                </div>

                <div className="pt-4 px-2">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-3 p-5 bg-rose-50 text-rose-600 rounded-2xl font-black shadow-sm shadow-rose-100/50 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all duration-300 group"
                    >
                        <HiOutlineLogout className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Log Out From SplitEase
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-6 font-bold tracking-widest uppercase italic">
                        Version 1.2.0 • SplitEase Inc.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
