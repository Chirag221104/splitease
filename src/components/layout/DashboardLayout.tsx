"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">

            {/* DESKTOP SIDEBAR */}
            <Sidebar />

            {/* MOBILE SIDEBAR */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">

                    {/* Background Overlay */}
                    <div
                        className="absolute inset-0 bg-black bg-opacity-30"
                        onClick={() => setSidebarOpen(false)}
                    />

                    {/* Slide-in Sidebar */}
                    <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
                        <Sidebar mobile />
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div className="md:pl-64 flex flex-col flex-1">
                <Navbar onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
