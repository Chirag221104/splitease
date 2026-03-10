"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading SplitEase</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* DESKTOP SIDEBAR */}
            <div className="hidden md:block w-72 flex-shrink-0">
                <Sidebar />
            </div>

            {/* MOBILE SIDEBAR */}
            <AnimatePresence>
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        {/* Background Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                            onClick={() => setSidebarOpen(false)}
                        />

                        {/* Slide-in Sidebar */}
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl"
                        >
                            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MAIN CONTENT */}
            <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
                <Navbar onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 pb-12">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
