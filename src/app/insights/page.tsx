"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAllUserPersonalExpenses } from "@/lib/firestore";
import { PersonalExpense } from "@/types";
import PersonalAnalytics from "@/components/insights/PersonalAnalytics";
import Link from "next/link";
import { HiArrowLeft, HiChartBar } from "react-icons/hi";
import { motion } from "framer-motion";

export default function InsightsPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const data = await getAllUserPersonalExpenses(user.uid);
                setExpenses(data);
            } catch (error) {
                console.error("Error fetching personal insights:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Crunching your numbers...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pt-10 px-4 pb-20 space-y-10">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-4 transition-colors group"
                    >
                        <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        Personal <span className="text-teal-600 italic">Insights</span>
                    </h1>
                    <p className="text-gray-400 font-medium mt-1">
                        Your spending across all circles — powered by your personal share, not group totals.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                >
                    <div className="bg-teal-50/60 px-5 py-2.5 rounded-2xl border border-teal-100/60 flex items-center gap-2">
                        <HiChartBar className="w-4 h-4 text-teal-500" />
                        <span className="text-[10px] font-black uppercase text-teal-600 tracking-wider">
                            {expenses.length} Transactions Analyzed
                        </span>
                    </div>
                </motion.div>
            </header>

            <PersonalAnalytics expenses={expenses} />
        </div>
    );
}
