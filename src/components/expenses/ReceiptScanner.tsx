"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { HiCamera, HiSparkles, HiRefresh, HiCheck } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface ReceiptScannerProps {
    onScanComplete: (data: { amount: number; description: string; date?: string; category?: string }) => void;
}

export const ReceiptScanner = ({ onScanComplete }: ReceiptScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanStep, setScanStep] = useState<"idle" | "uploading" | "analyzing" | "complete">("idle");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanStep("analyzing");

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                
                const response = await fetch("/api/scan-receipt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: base64 }),
                });

                if (!response.ok) throw new Error("Failed to scan");
                const result = await response.json();
                
                setScanStep("complete");
                setTimeout(() => {
                    onScanComplete(result);
                    setIsScanning(false);
                    setScanStep("idle");
                }, 1000);
            };
        } catch (error) {
            console.error("Scan failed:", error);
            alert("Failed to read receipt. Please try again or enter manually.");
            setIsScanning(false);
            setScanStep("idle");
        }
    };

    return (
        <div className="relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
                capture="environment"
            />

            <AnimatePresence mode="wait">
                {isScanning ? (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-teal-600 text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-lg shadow-teal-200 border border-teal-500 overflow-hidden relative"
                    >
                        {/* Scanning beam animation */}
                        <motion.div 
                            initial={{ y: -50 }}
                            animate={{ y: 50 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent h-1 w-full z-0"
                        />

                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                                <HiSparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-teal-100">
                                    {scanStep === "analyzing" ? "AI Analyzing..." : "Finalizing..."}
                                </p>
                                <p className="text-[10px] font-bold text-white/70">Powered by Gemini 1.5 Flash</p>
                            </div>
                        </div>

                        <div className="relative z-10">
                            {scanStep === "complete" ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <HiCheck className="w-6 h-6" />
                                </motion.div>
                            ) : (
                                <div className="flex gap-1">
                                    {[0, 1, 2].map(i => (
                                        <motion.div
                                            key={i}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                            className="w-1.5 h-1.5 bg-white rounded-full"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        key="idle"
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full group relative overflow-hidden bg-white border-2 border-dashed border-teal-200 hover:border-teal-500 p-6 rounded-[2rem] transition-all flex flex-col items-center gap-3"
                    >
                        <div className="absolute inset-0 bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-teal-500 group-hover:text-white transition-all relative z-10">
                            <HiCamera className="w-6 h-6" />
                        </div>
                        
                        <div className="text-center relative z-10">
                            <p className="text-xs font-black text-teal-700 uppercase tracking-widest mb-1 flex items-center justify-center gap-2">
                                <HiSparkles className="w-3 h-3" /> Scan Receipt
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">Autofill amount & details using AI</p>
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};
