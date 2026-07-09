import { Button } from "@/components/ui/Button";
import { HiExclamationCircle, HiX } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "primary" | "danger";
    isLoading?: boolean;
}

export function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel",
    confirmVariant = "danger",
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const isDangerous = confirmVariant === "danger";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-[32px] shadow-2xl shadow-gray-900/20 max-w-md w-full p-8 relative overflow-hidden"
                >
                    {/* Decorative background element */}
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-50 -mr-8 -mt-8 ${isDangerous ? 'bg-rose-50' : 'bg-teal-50'}`}></div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full z-10"
                    >
                        <HiX className="w-5 h-5" />
                    </button>

                    {/* Icon */}
                    <div className="flex justify-center mb-6 mt-2 relative z-10">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDangerous ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-500'} -rotate-6 transition-transform hover:rotate-0`}>
                            <HiExclamationCircle className="w-10 h-10" />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-black text-gray-900 text-center mb-3 italic tracking-tight relative z-10">
                        {title}
                    </h2>

                    {/* Message */}
                    <div className="text-sm font-medium text-gray-500 text-center mb-8 px-4 leading-relaxed relative z-10">
                        {message}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            isLoading={isLoading}
                            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all ${
                                isDangerous 
                                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' 
                                    : 'bg-teal-500 hover:bg-teal-600 text-white shadow-teal-200'
                            }`}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
