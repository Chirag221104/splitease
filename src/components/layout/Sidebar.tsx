"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
    HiHome,
    HiUserGroup,
    HiUsers,
    HiClock,
    HiCog,
    HiPlus
} from "react-icons/hi";
import { HiCurrencyRupee } from "react-icons/hi2";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useState, useEffect } from "react";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: HiHome },
    { name: "Groups", href: "/groups", icon: HiUserGroup },
    { name: "Friends", href: "/friends", icon: HiUsers },
    { name: "Expenses", href: "/expenses", icon: HiCurrencyRupee },
    { name: "Activity", href: "/activity", icon: HiClock },
    { name: "Settings", href: "/settings", icon: HiCog },
];

export function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [notifCount, setNotifCount] = useState(0);

    const [reqCount, setReqCount] = useState(0);
    const [invCount, setInvCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        // Listen for friend requests
        const qReq = query(
            collection(db, "friendRequests"),
            where("toId", "==", user.uid),
            where("status", "==", "pending")
        );
        const unsubscribeReq = onSnapshot(qReq, (snap) => {
            setReqCount(snap.size);
        });

        // Listen for group invites (invitedUid)
        const qInvUid = query(
            collection(db, "invites"),
            where("invitedUid", "==", user.uid),
            where("status", "==", "pending")
        );
        const unsubscribeInvUid = onSnapshot(qInvUid, (snap) => {
            setInvCount(snap.size);
        });

        return () => {
            unsubscribeReq();
            unsubscribeInvUid();
        };
    }, [user]);

    const totalNotifs = reqCount + invCount;

    return (
        <div
            className={clsx(
                "flex flex-col bg-white h-full w-72 transition-all duration-300",
                mobile ? "flex shadow-2xl" : "hidden md:flex md:fixed md:inset-y-0"
            )}
        >
            <div className="flex items-center justify-between h-20 px-6 bg-[#030508]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <HiUserGroup className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-black text-white tracking-tight italic">
                        SplitEase
                    </h1>
                </div>
                {mobile && (
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <HiPlus className="w-6 h-6 rotate-45" />
                    </button>
                )}
            </div>

            <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto bg-white border-r border-gray-100/50">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={onClose}
                            className={clsx(
                                isActive
                                    ? "bg-teal-50 text-teal-700 shadow-sm border border-teal-100/50"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent",
                                "group flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-200"
                            )}
                        >
                            <item.icon
                                className={clsx(
                                    isActive ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600",
                                    "mr-4 h-5 w-5 transition-colors"
                                )}
                            />
                            <span className="flex-1">{item.name}</span>
                            {item.name === "Friends" && totalNotifs > 0 && (
                                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-sm shadow-rose-200 animate-pulse">
                                    {totalNotifs}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>


        </div>
    );
}
