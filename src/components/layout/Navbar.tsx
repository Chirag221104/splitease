"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { HiMenu, HiHome, HiBell } from "react-icons/hi";
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
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm">
            <div className="flex items-center gap-3 px-4">
                <button
                    type="button"
                    className="p-2 -ml-2 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 md:hidden"
                    onClick={onMenuClick}
                >
                    <span className="sr-only">Open sidebar</span>
                    <HiMenu className="h-6 w-6" aria-hidden="true" />
                </button>
            </div>

            <div className="flex-1 flex justify-end items-center px-4">
                <h1 className="text-lg font-semibold text-gray-900 md:hidden mr-auto ml-4">SplitEase</h1>
                <div className="ml-4 flex items-center md:ml-6">
                    <Link href="/friends" className="relative p-2 text-gray-400 hover:text-gray-500 mr-4 group">
                        <HiBell className="h-6 w-6" />
                        {requestCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 bg-rose-500 rounded-full border-2 border-white items-center justify-center">
                                <span className="text-[8px] font-black text-white">{requestCount}</span>
                            </span>
                        )}
                        <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-gray-900 text-white text-[10px] font-black py-1 px-2 rounded-md whitespace-nowrap">
                            Friend Requests
                        </div>
                    </Link>
                    <span className="text-sm text-gray-700 mr-4">
                        {user?.displayName || user?.email}
                    </span>
                    <Button variant="ghost" size="sm" onClick={logout}>
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
}
