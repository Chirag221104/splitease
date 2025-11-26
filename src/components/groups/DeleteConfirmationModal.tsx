import { Button } from "@/components/ui/Button";
import { HiExclamationCircle, HiX } from "react-icons/hi";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    groupName: string;
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, groupName }: DeleteConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <HiX className="w-6 h-6" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <HiExclamationCircle className="w-10 h-10 text-red-600" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                    Delete Group?
                </h2>

                {/* Message */}
                <p className="text-gray-600 text-center mb-6">
                    Are you sure you want to delete <span className="font-semibold text-gray-900">"{groupName}"</span>?
                </p>

                {/* Warning box */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-red-800">
                        <strong>This action cannot be undone.</strong> This will permanently delete:
                    </p>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>All expenses</li>
                        <li>All settlements</li>
                        <li>All activity history</li>
                        <li>All group data</li>
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                        Delete Group
                    </Button>
                </div>
            </div>
        </div>
    );
}
