"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAllExpensesForUser } from "@/lib/firestore";
import { ExpenseWithGroup } from "@/types";
import { Button } from "@/components/ui/Button";
import { HiPlus } from "react-icons/hi";
import { format } from "date-fns";

export default function ExpensesPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<ExpenseWithGroup[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExpenses = async () => {
            if (!user) return;
            try {
                const allExpenses = await getAllExpensesForUser(user.uid);
                setExpenses(allExpenses);
            } catch (error) {
                console.error("Error fetching expenses:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchExpenses();
    }, [user]);

    const formatDate = (timestamp: any) => {
        try {
            let date: Date;
            if (typeof timestamp === 'number') {
                date = new Date(timestamp);
            } else if (timestamp?.toDate) {
                date = timestamp.toDate();
            } else if (timestamp?.seconds) {
                date = new Date(timestamp.seconds * 1000);
            } else {
                date = new Date();
            }
            return format(date, 'MMM dd, yyyy');
        } catch (error) {
            return 'Unknown date';
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-center text-gray-500 py-10">
                        <p>Loading expenses...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">All Expenses</h1>
            </div>

            {expenses.length === 0 ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-center text-gray-500 py-10">
                        <p>No expenses yet — add an expense inside your groups!</p>
                        <p className="text-sm mt-2">Create a group and start tracking expenses.</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {expenses.map((expense) => (
                        <div
                            key={expense.id}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                {/* Left Section */}
                                <div className="flex-1 space-y-2">
                                    {/* Group Badge */}
                                    <div className="inline-flex items-center gap-2">
                                        <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">
                                            Group: {expense.groupName}
                                        </span>
                                    </div>

                                    {/* Expense Details */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {expense.description}
                                        </h3>
                                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-600">
                                            <span>
                                                Amount: <span className="font-bold text-gray-900">₹{expense.amount.toFixed(2)}</span>
                                            </span>
                                            <span>•</span>
                                            <span>
                                                Paid by: <span className="font-medium">{expense.paidBy || 'Multiple'}</span>
                                            </span>
                                            <span>•</span>
                                            <span>
                                                Date: {formatDate(expense.createdAt || expense.date)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section - View Group Button */}
                                <div className="flex-shrink-0">
                                    <Link href={`/groups/${expense.groupId}`}>
                                        <Button variant="outline" size="sm">
                                            View Group
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
