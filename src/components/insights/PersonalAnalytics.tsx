"use client";

import { useMemo, useState } from "react";
import { PersonalExpense } from "@/types";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    BarChart, Bar
} from "recharts";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachMonthOfInterval,
    subMonths,
    isWithinInterval,
    startOfDay,
    endOfDay
} from "date-fns";
import { motion } from "framer-motion";
import { HiTrendingUp, HiTrendingDown, HiArrowSmRight } from "react-icons/hi";

const COLORS = [
    "#0d9488", "#6366f1", "#f43f5e", "#f59e0b", "#8b5cf6",
    "#10b981", "#3b82f6", "#ec4899", "#f97316", "#06b6d4"
];

const CATEGORY_ICONS: Record<string, string> = {
    "Food": "🍔", "Travel": "✈️", "Shopping": "🛍️", "Entertainment": "🎬",
    "Utilities": "💡", "Transport": "🚗", "Rent": "🏠", "Medical": "🏥",
    "Insurance": "🛡️", "Others": "📦"
};

type DateFilter = "30d" | "90d" | "6m" | "1y" | "all";

interface PersonalAnalyticsProps {
    expenses: PersonalExpense[];
}

export default function PersonalAnalytics({ expenses }: PersonalAnalyticsProps) {
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");

    // Filter expenses by date range
    const filteredExpenses = useMemo(() => {
        if (dateFilter === "all") return expenses;

        const now = new Date();
        let start: Date;
        switch (dateFilter) {
            case "30d": start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            case "90d": start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
            case "6m": start = subMonths(now, 6); break;
            case "1y": start = subMonths(now, 12); break;
            default: return expenses;
        }
        return expenses.filter(e => e.date >= start.getTime());
    }, [expenses, dateFilter]);

    // Summary stats
    const stats = useMemo(() => {
        const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.personalShare, 0);
        const now = new Date();
        const thisMonthStart = startOfMonth(now).getTime();
        const thisMonthEnd = endOfMonth(now).getTime();
        const thisMonthExpenses = filteredExpenses.filter(e => e.date >= thisMonthStart && e.date <= thisMonthEnd);
        const thisMonthSpent = thisMonthExpenses.reduce((sum, e) => sum + e.personalShare, 0);

        // Most active group
        const groupTotals: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            groupTotals[e.groupName] = (groupTotals[e.groupName] || 0) + e.personalShare;
        });
        const mostActiveGroup = Object.entries(groupTotals).sort((a, b) => b[1] - a[1])[0];

        // Average monthly
        if (filteredExpenses.length === 0) return { totalSpent: 0, thisMonthSpent: 0, mostActiveGroup: null, avgMonthly: 0 };
        const dates = filteredExpenses.map(e => e.date);
        const earliest = Math.min(...dates);
        const latest = Math.max(...dates);
        const monthSpan = Math.max(1, Math.ceil((latest - earliest) / (30 * 24 * 60 * 60 * 1000)));
        const avgMonthly = totalSpent / monthSpan;

        return { totalSpent, thisMonthSpent, mostActiveGroup, avgMonthly };
    }, [filteredExpenses]);

    // Category breakdown (Pie chart)
    const categoryData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            data[e.category] = (data[e.category] || 0) + e.personalShare;
        });
        return Object.entries(data)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value);
    }, [filteredExpenses]);

    // Monthly trend (Area chart)
    const monthlyTrend = useMemo(() => {
        if (filteredExpenses.length === 0) return [];
        const dates = filteredExpenses.map(e => e.date);
        const earliest = Math.min(...dates);
        const latest = Math.max(...dates);
        const start = startOfMonth(new Date(earliest));
        const end = endOfMonth(new Date(latest));
        const months = eachMonthOfInterval({ start, end });

        let runningTotal = 0;
        return months.map(month => {
            const monthStart = startOfMonth(month).getTime();
            const monthEnd = endOfMonth(month).getTime();
            const amount = filteredExpenses
                .filter(e => e.date >= monthStart && e.date <= monthEnd)
                .reduce((sum, e) => sum + e.personalShare, 0);
            runningTotal += amount;
            return {
                name: format(month, "MMM yy"),
                amount: Math.round(amount),
                cumulative: Math.round(runningTotal)
            };
        });
    }, [filteredExpenses]);

    // Group breakdown (Bar chart)
    const groupData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            data[e.groupName] = (data[e.groupName] || 0) + e.personalShare;
        });
        return Object.entries(data)
            .map(([name, value]) => ({ name, spent: Math.round(value) }))
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 8);
    }, [filteredExpenses]);

    // Top expenses
    const topExpenses = useMemo(() => {
        return [...filteredExpenses]
            .sort((a, b) => b.personalShare - a.personalShare)
            .slice(0, 5);
    }, [filteredExpenses]);

    // Spending velocity
    const velocity = useMemo(() => {
        const now = new Date();
        const thisMonth = filteredExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const lastMonth = filteredExpenses.filter(e => {
            const d = new Date(e.date);
            const lm = subMonths(now, 1);
            return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
        });
        const thisTotal = thisMonth.reduce((s, e) => s + e.personalShare, 0);
        const lastTotal = lastMonth.reduce((s, e) => s + e.personalShare, 0);
        const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;
        return { thisTotal, lastTotal, change };
    }, [filteredExpenses]);

    // Empty state
    if (expenses.length === 0) {
        return (
            <div className="bg-white rounded-[2.5rem] p-16 border border-gray-100 text-center space-y-6 shadow-sm">
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-5xl">📊</span>
                </div>
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">No Spending Data Yet</h3>
                <p className="text-gray-400 max-w-md mx-auto font-medium">
                    Start adding expenses to your groups and your personal spending insights will appear here automatically.
                </p>
                <a href="/dashboard" className="inline-block mt-4 px-8 py-3 bg-teal-600 text-white rounded-2xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-lg shadow-teal-100">
                    Go to Dashboard
                </a>
            </div>
        );
    }

    const dateFilters: { label: string; value: DateFilter }[] = [
        { label: "30 Days", value: "30d" },
        { label: "90 Days", value: "90d" },
        { label: "6 Months", value: "6m" },
        { label: "1 Year", value: "1y" },
        { label: "All Time", value: "all" },
    ];

    return (
        <div className="space-y-8">
            {/* Date Filters */}
            <div className="flex flex-wrap gap-2">
                {dateFilters.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setDateFilter(f.value)}
                        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilter === f.value
                            ? "bg-teal-600 text-white shadow-lg shadow-teal-100"
                            : "bg-white text-gray-400 border border-gray-100 hover:border-teal-200 hover:text-teal-600"
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-bl-full opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Spent</p>
                    <p className="text-2xl font-black text-gray-900">₹{stats.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] font-bold text-gray-300 mt-1 uppercase">Your personal share</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-bl-full opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">This Month</p>
                    <p className="text-2xl font-black text-gray-900">₹{stats.thisMonthSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <div className="flex items-center gap-1 mt-1">
                        {velocity.change > 0 ? (
                            <><HiTrendingUp className="w-3 h-3 text-rose-400" /><span className="text-[10px] font-black text-rose-400">+{velocity.change.toFixed(0)}%</span></>
                        ) : velocity.change < 0 ? (
                            <><HiTrendingDown className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-black text-emerald-500">{velocity.change.toFixed(0)}%</span></>
                        ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase">No prior data</span>
                        )}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-full opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Top Circle</p>
                    <p className="text-lg font-black text-gray-900 truncate">{stats.mostActiveGroup?.[0] || "—"}</p>
                    <p className="text-[10px] font-bold text-amber-500 mt-1">₹{(stats.mostActiveGroup?.[1] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-full opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Avg / Month</p>
                    <p className="text-2xl font-black text-gray-900">₹{stats.avgMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] font-bold text-gray-300 mt-1 uppercase">Running average</p>
                </motion.div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Category Pie */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Where Your Money Goes</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">By Category</p>
                        </div>
                        <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 text-lg">🥧</div>
                    </div>

                    {categoryData.length > 0 ? (
                        <>
                            <div className="h-[260px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                                            {categoryData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", padding: "12px 16px" }} formatter={(value: number) => [`₹${value.toLocaleString()}`, "Spent"]} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.1em" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Category Legend Cards */}
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {categoryData.slice(0, 4).map((cat, i) => (
                                    <div key={cat.name} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/50">
                                        <span className="text-sm">{CATEGORY_ICONS[cat.name] || "📦"}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-600 truncate">{cat.name}</p>
                                            <p className="text-[10px] font-bold" style={{ color: COLORS[i] }}>₹{cat.value.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-400 text-center py-12 italic">No data in this range</p>
                    )}
                </motion.div>

                {/* Group Breakdown Bar */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Circle Breakdown</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Your Spend Per Group</p>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 text-lg">👥</div>
                    </div>

                    {groupData.length > 0 ? (
                        <div className="h-[320px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={groupData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "#4b5563" }} width={100} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }} formatter={(value: number) => [`₹${value.toLocaleString()}`, "Your Share"]} />
                                    <Bar dataKey="spent" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={24} animationDuration={1500} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-12 italic">No data in this range</p>
                    )}
                </motion.div>

                {/* Monthly Trend */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Spending Pulse</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Monthly Trend</p>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 text-lg">📈</div>
                    </div>

                    {monthlyTrend.length > 0 ? (
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="personalColorWave" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: "#9ca3af" }} interval="preserveStartEnd" />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }} formatter={(value: number) => [`₹${value.toLocaleString()}`, "Your Share"]} />
                                    <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fill="url(#personalColorWave)" dot={{ r: 3, fill: '#f43f5e', strokeWidth: 1, stroke: '#fff' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-12 italic">No data in this range</p>
                    )}
                </motion.div>

                {/* Top Expenses */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Biggest Spends</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Top 5 Transactions</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 text-lg">🔥</div>
                    </div>

                    {topExpenses.length > 0 ? (
                        <div className="space-y-3">
                            {topExpenses.map((exp, i) => (
                                <div key={exp.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg font-black text-gray-300 border border-gray-100">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{exp.description}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{exp.groupName}</span>
                                            <span className="text-gray-200">•</span>
                                            <span className="text-[10px] font-bold text-gray-400">{format(new Date(exp.date), "MMM dd, yyyy")}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-teal-600">₹{exp.personalShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                        <p className="text-[9px] font-bold text-gray-300 uppercase">of ₹{exp.totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-12 italic">No data in this range</p>
                    )}
                </motion.div>
            </div>

            {/* Spending Highlights Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-900 text-white rounded-[2rem] p-8 shadow-xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-bl-full" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-400 mb-6 relative z-10">Spending Highlights</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Transactions</p>
                        <p className="text-3xl font-black">{filteredExpenses.length}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Highest Month</p>
                        <p className="text-xl font-black">
                            {monthlyTrend.length > 0
                                ? `₹${Math.max(...monthlyTrend.map(m => m.amount)).toLocaleString()}`
                                : "—"
                            }
                        </p>
                        <p className="text-[10px] font-bold text-teal-400 mt-1">
                            {monthlyTrend.length > 0
                                ? monthlyTrend.reduce((max, m) => m.amount > max.amount ? m : max, monthlyTrend[0]).name
                                : ""
                            }
                        </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Top Category</p>
                        <p className="text-xl font-black flex items-center gap-2">
                            <span>{CATEGORY_ICONS[categoryData[0]?.name] || "📦"}</span>
                            {categoryData[0]?.name || "—"}
                        </p>
                        <p className="text-[10px] font-bold text-teal-400 mt-1">
                            {categoryData[0] ? `₹${categoryData[0].value.toLocaleString()}` : ""}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
