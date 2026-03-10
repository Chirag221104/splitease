"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { HiMenu, HiHome, HiBell, HiUserGroup } from "react-icons/hi";
import Link from "next/link";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface NavbarProps {
    onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
    const { user, logout } = useAuth();
    const [requestCount, setRequestCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "friendRequests"),
            where("toId", "==", user.uid),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequestCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <div className="sticky top-0 z-40 bg-[#030508] border-b border-white/[0.05] h-20 flex-shrink-0 flex items-center justify-between px-6 md:px-10">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    className="p-2.5 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all focus:outline-none md:hidden"
                    onClick={onMenuClick}
                >
                    <HiMenu className="h-6 w-6" />
                </button>
                <div className="md:hidden flex items-center gap-2">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <HiUserGroup className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-black text-white tracking-tight italic">SplitEase</h1>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                <Link href="/friends" className="relative p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group">
                    <HiBell className="h-6 w-6" />
                    {requestCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 bg-rose-500 rounded-full border-2 border-[#030508] items-center justify-center">
                            <span className="text-[8px] font-black text-white">{requestCount}</span>
                        </span>
                    )}
                </Link>

                <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block"></div>

                <div className="flex items-center gap-3 pl-1 sm:pl-2">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-bold text-white leading-none">
                            {user?.displayName || "Member"}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 mt-1">Verified</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 font-black text-sm shadow-sm">
                        {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={logout}
                        className="text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl px-3 font-bold text-[11px] uppercase tracking-widest"
                    >
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
    );
}
