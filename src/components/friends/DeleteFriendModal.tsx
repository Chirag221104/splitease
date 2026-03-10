import { Button } from "@/components/ui/Button";
import { HiExclamationCircle, HiX } from "react-icons/hi";

interface DeleteFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    friendName: string;
}

export function DeleteFriendModal({ isOpen, onClose, onConfirm, friendName }: DeleteFriendModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in duration-200 border border-red-100">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <HiX className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-6 mt-2">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                        <HiExclamationCircle className="w-8 h-8 text-red-500" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-black text-gray-900 text-center mb-2 italic tracking-tight">
                    Remove Friend?
                </h2>

                {/* Message */}
                <p className="text-gray-500 text-center mb-8 font-medium text-sm">
                    Are you sure you want to remove <span className="font-bold text-gray-900">"{friendName}"</span> from your network? You will no longer be able to add them to new groups.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border-gray-200"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg shadow-red-200"
                    >
                        Remove
                    </Button>
                </div>
            </div>
        </div>
    );
}
