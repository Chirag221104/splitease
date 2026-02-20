"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { format, startOfMonth, endOfMonth, isWithinInterval, isBefore } from "date-fns";
import { Group, Expense, Settlement, User } from "@/types";
import { generatePDFReport, generateExcelReport } from "@/lib/reports";
import { calculateGroupBalances } from "@/lib/calculations";
import { normalizeDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HiDownload, HiX, HiDocumentText, HiTable, HiCalendar } from "react-icons/hi";
import { motion } from "framer-motion";
import { useToast } from "@/context/ToastContext";

interface ExportReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    expenses: Expense[];
    settlements: Settlement[];
    members: Record<string, User>;
}

export function ExportReportModal({ isOpen, onClose, group, expenses, settlements, members }: ExportReportModalProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [format_type, setFormatType] = useState<"pdf" | "excel">("pdf");
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen || !user) return null;

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            // 1. Filter data within range
            const filteredExpenses = expenses.filter(e =>
                isWithinInterval(normalizeDate(e.date), { start, end }) && !e.isDeleted
            );
            const filteredSettlements = settlements.filter(s =>
                isWithinInterval(normalizeDate(s.date), { start, end })
            );

            // 2. Calculate Opening Balance (Net position before startDate)
            const historicalExpenses = expenses.filter(e =>
                isBefore(normalizeDate(e.date), start) && !e.isDeleted
            );
            const historicalSettlements = settlements.filter(s =>
                isBefore(normalizeDate(s.date), start)
            );

            const historicalBalances = calculateGroupBalances(historicalExpenses, historicalSettlements, group.members);
            const openingBalance = historicalBalances[user.uid] || 0;

            const reportData = {
                group,
                expenses: filteredExpenses.sort((a, b) => normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime()),
                settlements: filteredSettlements.sort((a, b) => normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime()),
                members: group.members.map(id => members[id]).filter(Boolean),
                currentUser: members[user.uid],
                startDate: start,
                endDate: end,
                openingBalance
            };

            if (format_type === "pdf") {
                generatePDFReport(reportData);
            } else {
                generateExcelReport(reportData);
            }

            showToast("Report generated successfully", "success");
            onClose();
        } catch (error) {
            console.error("Export error:", error);
            showToast("Failed to generate report", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
                <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <HiDownload className="text-teal-600" />
                            Export Data
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">Generate a financial audit for {group.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <HiX className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Date Range Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <HiCalendar className="text-teal-500" /> From
                            </label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="rounded-2xl border-gray-100 h-12 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <HiCalendar className="text-rose-500" /> To
                            </label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="rounded-2xl border-gray-100 h-12 font-bold"
                            />
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Format</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setFormatType("pdf")}
                                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${format_type === "pdf"
                                    ? "border-teal-600 bg-teal-50 text-teal-700"
                                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                                    }`}
                            >
                                <HiDocumentText className="w-8 h-8" />
                                <span className="font-black italic">PDF Document</span>
                            </button>
                            <button
                                onClick={() => setFormatType("excel")}
                                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${format_type === "excel"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                                    }`}
                            >
                                <HiTable className="w-8 h-8" />
                                <span className="font-black italic">Excel Sheet</span>
                            </button>
                        </div>
                    </div>

                    {/* Action */}
                    <Button
                        size="lg"
                        onClick={handleExport}
                        isLoading={isGenerating}
                        className="w-full h-16 rounded-2xl font-black text-xl shadow-xl shadow-teal-100/50"
                    >
                        Generate Report
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
