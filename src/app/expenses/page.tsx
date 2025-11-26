"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HiPlus } from "react-icons/hi";

export default function ExpensesPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
                <Link href="/expenses/add">
                    <Button className="flex items-center gap-2">
                        <HiPlus className="w-5 h-5" />
                        Add Expense
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-center text-gray-500 py-10">
                    <p>No expenses to show yet.</p>
                    <p className="text-sm mt-2">Add an expense to get started!</p>
                </div>
            </div>
        </div>
    );
}
