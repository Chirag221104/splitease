"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAllExpensesForUser } from "@/lib/firestore";
import { ExpenseWithGroup } from "@/types";
import { Button } from "@/components/ui/Button";
import { HiPlus } from "react-icons/hi";
import { format } from "date-fns";

import { motion } from "framer-motion";

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
            return format(date, 'MMM dd');
        } catch (error) {
            return '—';
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">All Expenses</h1>
                <p className="text-gray-500 mt-1">A unified history of everything you've shared</p>
            </header>

            {expenses.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"
                >
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">🧾</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">No expenses found</h3>
                    <p className="mt-2 text-gray-500 max-w-xs mx-auto">Expenses you add inside your groups will appear here.</p>
                </motion.div>
            ) : (
                <div className="grid gap-4">
                    {expenses.map((expense, index) => (
                        <motion.div
                            key={expense.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-teal-50 transition-all duration-300 group"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                                {/* Left Section - Date & Description */}
                                <div className="flex items-center gap-6">
                                    <div className="bg-gray-50 p-2 text-center min-w-[60px] rounded-xl group-hover:bg-teal-50 transition-colors duration-300">
                                        <p className="text-[10px] uppercase font-black text-gray-400 group-hover:text-teal-400">
                                            {formatDate(expense.createdAt || expense.date).split(' ')[0]}
                                        </p>
                                        <p className="text-lg font-black text-gray-900 group-hover:text-teal-700">
                                            {formatDate(expense.createdAt || expense.date).split(' ')[1]}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black tracking-widest uppercase rounded border border-amber-100">
                                            {expense.groupName}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 truncate">
                                            {expense.description}
                                        </h3>
                                        <p className="text-sm text-gray-500 font-medium italic">
                                            Paid by <span className="text-gray-900 no-italic font-bold">{expense.paidBy || 'Multiple'}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Right Section - Amount & Action */}
                                <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-6 sm:border-l border-gray-50 ">
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-teal-600">
                                            <span className="text-teal-500 mr-0.5 font-medium">₹</span>{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                            Total Amount
                                        </p>
                                    </div>
                                    <Link href={`/groups/${expense.groupId}`} className="shrink-0 transition-transform group-hover:translate-x-1">
                                        <Button variant="outline" size="sm" className="rounded-xl border-gray-100 hover:border-teal-200">
                                            View Group
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
