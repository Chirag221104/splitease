"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { HiMenu, HiHome } from "react-icons/hi";
import Link from "next/link";

interface NavbarProps {
    onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
    const { user, logout } = useAuth();

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
