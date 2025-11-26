"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
    HiHome,
    HiUserGroup,
    HiCurrencyDollar,
    HiClock,
    HiCog
} from "react-icons/hi";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: HiHome },
    { name: "Groups", href: "/groups", icon: HiUserGroup },
    { name: "Expenses", href: "/expenses", icon: HiCurrencyDollar },
    { name: "Activity", href: "/activity", icon: HiClock },
    { name: "Settings", href: "/settings", icon: HiCog },
];

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
    const pathname = usePathname();

    return (
        <div
            className={clsx(
                mobile
                    ? "w-64 flex flex-col h-full bg-white border-r border-gray-200"
                    : "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200"
            )}
        >
            <div className="flex items-center h-16 px-4 bg-teal-600">
                <h1 className="text-xl font-bold text-white">SplitEase</h1>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={clsx(
                                isActive
                                    ? "bg-teal-50 text-teal-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                                "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                            )}
                        >
                            <item.icon
                                className={clsx(
                                    isActive ? "text-teal-500" : "text-gray-400 group-hover:text-gray-500",
                                    "mr-3 h-6 w-6"
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
