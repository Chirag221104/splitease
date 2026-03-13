"use client";

import { useMemo } from "react";
import { Expense, User, Group } from "@/types";
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
    differenceInDays,
    startOfDay,
    endOfDay,
    eachDayOfInterval,
    isSameDay,
    parseISO
} from "date-fns";
import { motion } from "framer-motion";

interface GroupAnalyticsProps {
    expenses: Expense[];
    members: User[];
    group?: Group;
}

// Diverse, high-contrast color palette for categories
const COLORS = [
    "#0d9488", // Teal
    "#6366f1", // Indigo
    "#f43f5e", // Rose
    "#f59e0b", // Amber
    "#8b5cf6", // Violet
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#ec4899", // Pink
    "#f97316", // Orange
    "#06b6d4"  // Cyan
];

export default function GroupAnalytics({ expenses, members, group }: GroupAnalyticsProps) {
    const activeExpenses = useMemo(() => expenses.filter(e => !e.isDeleted), [expenses]);
    const membersMap = useMemo(() => members.reduce((acc, m) => {
        acc[m.uid] = m;
        return acc;
    }, {} as Record<string, User>), [members]);

    // 1. Data for Pie Chart (Spending by Category)
    const categoryData = useMemo(() => {
        const data: Record<string, number> = {};
        activeExpenses.forEach(e => {
            const cat = e.category || "Others";
            data[cat] = (data[cat] || 0) + e.amount;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [activeExpenses]);

    // 2. Data for Member Contributions (Bar Chart)
    const memberData = useMemo(() => {
        const data: Record<string, number> = {};
        // Initialize all members with 0
        members.forEach(m => data[m.uid] = 0);

        activeExpenses.forEach(e => {
            if (e.contributors) {
                Object.entries(e.contributors).forEach(([uid, amount]) => {
                    data[uid] = (data[uid] || 0) + amount;
                });
            } else if (e.paidBy) {
                data[e.paidBy] = (data[e.paidBy] || 0) + e.amount;
            }
        });

        return Object.entries(data).map(([uid, paid]) => ({
            name: membersMap[uid]?.displayName || membersMap[uid]?.username || "Unknown",
            paid
        })).sort((a, b) => b.paid - a.paid);
    }, [activeExpenses, members, membersMap]);

    // 3. Smart Trend Logic: Daily vs Monthly based on duration
    const trendData = useMemo(() => {
        if (activeExpenses.length === 0 && (!group?.startDate || !group?.endDate)) {
            // Default 6 months monthly view
            const end = endOfMonth(new Date());
            const start = startOfMonth(subMonths(end, 5));
            const months = eachMonthOfInterval({ start, end });
            return months.map(month => ({
                name: format(month, "MMM yyyy"),
                amount: 0,
                cumulative: 0
            }));
        }

        // Determine range
        let startRaw = group?.startDate;
        let endRaw = group?.endDate;

        if (!startRaw || !endRaw) {
            // If no dates set, find min/max from expenses
            if (activeExpenses.length > 0) {
                const dates = activeExpenses.map(e => e.date);
                startRaw = Math.min(...dates);
                endRaw = Math.max(...dates);
            } else {
                startRaw = Date.now();
                endRaw = Date.now();
            }
        }

        const startDate = startOfDay(new Date(startRaw));
        const endDate = endOfDay(new Date(endRaw));
        const daysDiff = differenceInDays(endDate, startDate);

        let dataPoints: { name: string, amount: number, date: Date }[] = [];

        // If duration is less than 32 days, show daily trend
        if (daysDiff <= 31) {
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            dataPoints = days.map(day => {
                const dayStart = startOfDay(day).getTime();
                const dayEnd = endOfDay(day).getTime();
                const amount = activeExpenses
                    .filter(e => e.date >= dayStart && e.date <= dayEnd)
                    .reduce((sum, e) => sum + e.amount, 0);

                return {
                    name: format(day, "MMM dd"),
                    amount,
                    date: day
                };
            });
        } else {
            // Otherwise, show monthly trend
            const startMonth = startOfMonth(startDate);
            const endMonth = endOfMonth(endDate);
            const months = eachMonthOfInterval({ start: startMonth, end: endMonth });

            // If range is too small (e.g. 1 month span), ensure we show at least 3 months for context if possible
            let displayMonths = months;
            if (months.length < 3) {
                const contextStart = startOfMonth(subMonths(startMonth, 2));
                displayMonths = eachMonthOfInterval({ start: contextStart, end: endMonth });
            }

            dataPoints = displayMonths.map(month => {
                const monthStart = startOfMonth(month).getTime();
                const monthEnd = endOfMonth(month).getTime();
                const amount = activeExpenses
                    .filter(e => e.date >= monthStart && e.date <= monthEnd)
                    .reduce((sum, e) => sum + e.amount, 0);

                return {
                    name: format(month, "MMM yyyy"),
                    amount,
                    date: month
                };
            });
        }

        // Calculate Cumulative
        let runningTotal = 0;
        return dataPoints.map(dp => {
            runningTotal += dp.amount;
            return {
                ...dp,
                cumulative: runningTotal
            };
        });
    }, [activeExpenses, group]);

    // 4. Budget Analytics
    const budgetStats = useMemo(() => {
        if (!group?.budgetLimit) return null;

        const totalSpent = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
        const percentage = Math.min((totalSpent / group.budgetLimit) * 100, 100);
        const isOver = totalSpent > group.budgetLimit;

        // Status color
        let color = "#10b981"; // Emerald (Safe)
        if (percentage > 70) color = "#f59e0b"; // Amber (Warning)
        if (isOver) color = "#f43f5e"; // Rose (Danger)

        return {
            totalSpent,
            limit: group.budgetLimit,
            percentage,
            isOver,
            color,
            remaining: group.budgetLimit - totalSpent
        };
    }, [activeExpenses, group]);

    if (activeExpenses.length === 0 && (!group?.startDate || !group?.endDate)) {
        return (
            <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-4 shadow-sm">
                <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl text-teal-600">📊</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800">No Analytics Yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Add some expenses or set a trip duration to see your financial pulse.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 0. Budget Visualization */}
            {budgetStats && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gray-50 rounded-bl-[120px] -z-10 opacity-40" />

                    <div className="flex flex-col md:flex-row items-center gap-10">
                        {/* Gauge */}
                        <div className="relative w-40 h-40 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    stroke="#f1f5f9"
                                    strokeWidth="12"
                                    fill="transparent"
                                />
                                <motion.circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    stroke={budgetStats.color}
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={440}
                                    initial={{ strokeDashoffset: 440 }}
                                    animate={{ strokeDashoffset: 440 - (440 * budgetStats.percentage) / 100 }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-gray-900 tracking-tighter">{Math.round(budgetStats.percentage)}%</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Spent</span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 space-y-6 w-full">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Budget Tracker</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                        Per {group?.budgetPeriod || 'trip'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${budgetStats.isOver ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {budgetStats.isOver ? 'Over budget' : 'Under control'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Spent</p>
                                    <p className="text-xl font-black text-gray-900">₹{budgetStats.totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Limit</p>
                                    <p className="text-xl font-black text-gray-900">₹{budgetStats.limit.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50 col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{budgetStats.isOver ? 'Exceeded By' : 'Remaining'}</p>
                                    <p className={`text-xl font-black ${budgetStats.isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        ₹{Math.abs(budgetStats.remaining).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Category Breakdown */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Spending Breakdown</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">By Category</p>
                        </div>
                        <div className="p-3 bg-teal-50 rounded-2xl text-teal-600">
                            <span className="text-lg font-black italic">₹</span>
                        </div>
                    </div>

                    <div className="h-[280px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", padding: "12px 16px" }}
                                    itemStyle={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase" }}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Total"]}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: "20px", fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.1em" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 2. Member Contribution Breakdown */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Top Contributors</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Who Paid What</p>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 font-black">
                            <span>👤</span>
                        </div>
                    </div>

                    <div className="h-[280px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={memberData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fill: "#4b5563" }}
                                    width={100}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Has Paid"]}
                                />
                                <Bar
                                    dataKey="paid"
                                    fill="#6366f1"
                                    radius={[0, 10, 10, 0]}
                                    barSize={24}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 3. Monthly/Daily Trend */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Financial Pulse</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                                {trendData.length <= 31 ? "Daily Spikes" : "Monthly Waves"}
                            </p>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 font-black italic">
                            <span>📈</span>
                        </div>
                    </div>

                    <div className="h-[280px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: "#9ca3af" }}
                                    interval={trendData.length > 7 ? "preserveStartEnd" : 0}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Spent"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#f43f5e"
                                    strokeWidth={3}
                                    fill="url(#colorWave)"
                                    dot={trendData.length <= 31 ? { r: 3, fill: '#f43f5e', strokeWidth: 1, stroke: '#fff' } : false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 4. Total Burn Breakdown */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -z-10 opacity-40 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Total Burn</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Cumulative Growth</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 font-black italic">
                            <span>🔥</span>
                        </div>
                    </div>

                    <div className="h-[280px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: "#9ca3af" }}
                                    interval={trendData.length > 7 ? "preserveStartEnd" : 0}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Running Total"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cumulative"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fill="url(#colorBurn)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {group?.startDate && group?.endDate && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-8 bg-teal-600 rounded-[2rem] flex flex-col md:flex-row justify-between items-center text-white shadow-xl shadow-teal-100"
                >
                    <div className="flex items-center gap-6 mb-4 md:mb-0">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                            🗓️
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Trip Timeline</p>
                            <h4 className="text-xl font-black italic">
                                {format(new Date(group.startDate), "MMM dd")} <span className="mx-2 opacity-50 font-normal">→</span> {format(new Date(group.endDate), "MMM dd, yyyy")}
                            </h4>
                        </div>
                    </div>
                    <div className="bg-white/10 px-8 py-4 rounded-3xl backdrop-blur-md border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Total Duration</p>
                        <p className="text-2xl font-black tracking-tight">{differenceInDays(new Date(group.endDate), new Date(group.startDate)) + 1} Phenomenal Days</p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
