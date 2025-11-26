"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { HiCheckCircle, HiXCircle, HiInformationCircle } from "react-icons/hi";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(7);
        const toast: Toast = { id, message, type };

        setToasts((prev) => [...prev, toast]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 space-y-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-in slide-in-from-right ${toast.type === "success"
                                ? "bg-green-50 text-green-800 border border-green-200"
                                : toast.type === "error"
                                    ? "bg-red-50 text-red-800 border border-red-200"
                                    : "bg-blue-50 text-blue-800 border border-blue-200"
                            }`}
                    >
                        {toast.type === "success" && <HiCheckCircle className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === "error" && <HiXCircle className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === "info" && <HiInformationCircle className="w-5 h-5 flex-shrink-0" />}
                        <span className="text-sm font-medium">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
