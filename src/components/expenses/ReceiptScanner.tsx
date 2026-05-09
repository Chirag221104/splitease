"use client";

import { useState, useRef, useCallback } from "react";
import { HiCamera, HiSparkles, HiCheck } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface ReceiptScannerProps {
    onScanComplete: (data: { amount: number; description: string; date?: string; category?: string }) => void;
}

export const ReceiptScanner = ({ onScanComplete }: ReceiptScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanStep, setScanStep] = useState<"idle" | "analyzing" | "complete">("idle");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = useCallback(async (file: File) => {
        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file.");
            return;
        }

        setIsScanning(true);
        setScanStep("analyzing");

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64 = reader.result as string;
                    
                    const response = await fetch("/api/scan-receipt", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image: base64 }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to scan");
                    }

                    const result = await response.json();
                    
                    setScanStep("complete");
                    setTimeout(() => {
                        onScanComplete(result);
                        setIsScanning(false);
                        setScanStep("idle");
                    }, 800);
                } catch (error: any) {
                    console.error("Scan failed:", error);
                    alert(error.message || "Failed to read receipt. Please try again or enter manually.");
                    setIsScanning(false);
                    setScanStep("idle");
                }
            };
        } catch (error) {
            console.error("File read failed:", error);
            setIsScanning(false);
            setScanStep("idle");
        }
    }, [onScanComplete]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
        // Reset input so the same file can be re-selected
        e.target.value = "";
    };

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

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
                                    {scanStep === "analyzing" ? "AI Analyzing..." : "Done!"}
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
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full cursor-pointer group relative overflow-hidden border-2 border-dashed p-6 rounded-[2rem] transition-all flex flex-col items-center gap-3 ${
                            isDragging
                                ? "border-teal-500 bg-teal-50 scale-[1.02]"
                                : "border-teal-200 bg-white hover:border-teal-500"
                        }`}
                    >
                        <div className={`absolute inset-0 transition-opacity ${isDragging ? "bg-teal-50 opacity-100" : "bg-teal-50 opacity-0 group-hover:opacity-100"}`} />
                        
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all relative z-10 ${
                            isDragging
                                ? "bg-teal-500 text-white scale-110"
                                : "bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-white"
                        }`}>
                            <HiCamera className="w-6 h-6" />
                        </div>
                        
                        <div className="text-center relative z-10">
                            <p className="text-xs font-black text-teal-700 uppercase tracking-widest mb-1 flex items-center justify-center gap-2">
                                <HiSparkles className="w-3 h-3" />
                                {isDragging ? "Drop Receipt Here" : "Scan Receipt"}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">
                                {isDragging ? "Release to start scanning" : "Click, tap, or drag & drop a receipt image"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
