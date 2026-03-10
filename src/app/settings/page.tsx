"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiUser, HiMail, HiOutlineLogout, HiChevronRight, HiArrowLeft, HiCheck, HiX } from "react-icons/hi";
import { updateUserProfile, checkUsernameAvailability, updateUserUsername } from "@/lib/firestore";
import { validateUsername } from "@/lib/utils";

type Section = 'none' | 'personal' | 'notifications';

export default function SettingsPage() {
    const { user, logout, refreshUser } = useAuth();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<Section>('none');

    // Personal Info State
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [username, setUsername] = useState(user?.username || "");
    const [usernameError, setUsernameError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Notification State
    const [notifications, setNotifications] = useState({
        expenseAdded: user?.notificationSettings?.expenseAdded ?? true,
        groupInvite: user?.notificationSettings?.groupInvite ?? true,
        settlementReceived: user?.notificationSettings?.settlementReceived ?? true,
    });

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || "");
            setUsername(user.username || "");
            setNotifications({
                expenseAdded: user.notificationSettings?.expenseAdded ?? true,
                groupInvite: user.notificationSettings?.groupInvite ?? true,
                settlementReceived: user.notificationSettings?.settlementReceived ?? true,
            });
        }
    }, [user]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const handleSavePersonal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        setUsernameError("");
        setSaveSuccess(false);

        try {
            // 1. Update Username if changed
            if (username && username !== user.username) {
                const validation = validateUsername(username);
                if (!validation.valid) {
                    setUsernameError(validation.error || "Invalid username");
                    setIsSaving(false);
                    return;
                }

                const available = await checkUsernameAvailability(username);
                if (!available) {
                    setUsernameError("Username already taken");
                    setIsSaving(false);
                    return;
                }

                await updateUserUsername(user.uid, username);
            }

            // 2. Update Display Name
            if (displayName !== user.displayName) {
                await updateUserProfile(user.uid, { displayName });
            }

            await refreshUser();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error: any) {
            console.error("Error saving profile:", error);
            setUsernameError(error.message || "Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile(user.uid, { notificationSettings: notifications });
            await refreshUser();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Error saving notifications:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const userInitials = user?.displayName
        ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
        : user?.email?.charAt(0).toUpperCase() || 'U';

    const containerVariants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-12 pt-16 px-4 overflow-hidden">
            <AnimatePresence mode="wait">
                {activeSection === 'none' ? (
                    <motion.div
                        key="main"
                        variants={containerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="space-y-8"
                    >
                        <header>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
                            <p className="text-gray-500 mt-1">Manage your account preferences</p>
                        </header>

                        {/* Profile Header Card */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full opacity-50 -mr-8 -mt-8 animate-pulse"></div>

                            <div className="w-24 h-24 bg-teal-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-teal-100 shrink-0 transition-transform duration-300">
                                {userInitials}
                            </div>

                            <div className="text-center sm:text-left z-10">
                                <h2 className="text-2xl font-black text-gray-900">{user?.displayName || "New User"}</h2>
                                {user?.username && <p className="text-teal-600 font-bold text-sm">@{user.username}</p>}
                                <p className="text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-1">
                                    <HiMail className="w-4 h-4" />
                                    {user?.email}
                                </p>
                            </div>
                        </div>

                        {/* Settings Sections */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                                <div
                                    onClick={() => setActiveSection('personal')}
                                    className="p-6 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                                                <HiUser className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">Personal Info</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Edit your name and username</p>
                                            </div>
                                        </div>
                                        <HiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 transition-colors" />
                                    </div>
                                </div>

                                <div
                                    onClick={() => setActiveSection('notifications')}
                                    className="p-6 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                                                <HiMail className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">Email Notifications</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Control how we message you</p>
                                            </div>
                                        </div>
                                        <HiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 transition-colors" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 px-2">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-3 p-5 bg-rose-50 text-rose-600 rounded-2xl font-black shadow-sm shadow-rose-100/50 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all duration-300 group"
                                >
                                    <HiOutlineLogout className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    Log Out From SplitEase
                                </button>
                                <p className="text-center text-[10px] text-gray-400 mt-6 font-bold tracking-widest uppercase italic">
                                    Version 1.2.0 • SplitEase Inc.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ) : activeSection === 'personal' ? (
                    <motion.div
                        key="personal"
                        variants={containerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="space-y-6 pt-10 sm:pt-4"
                    >
                        <button
                            onClick={() => setActiveSection('none')}
                            className="flex items-center gap-2 text-gray-400 hover:text-teal-600 transition-colors font-bold text-xs uppercase tracking-widest group mb-8"
                        >
                            <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Settings
                        </button>

                        <header className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Personal Info</h2>
                            <p className="text-gray-500 mt-1 font-medium">Update your profile details</p>
                        </header>

                        <form onSubmit={handleSavePersonal} className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                            <Input
                                label="Full Name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Add your name"
                                className="h-14 px-6 rounded-2xl"
                            />

                            <div className="space-y-2">
                                <Input
                                    label="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                    placeholder="choose_a_username"
                                    className="h-14 px-6 rounded-2xl"
                                />
                                {usernameError && <p className="text-rose-500 text-xs font-bold pl-1">{usernameError}</p>}
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1 leading-relaxed">
                                    Usernames are unique and used for inviting friends
                                </p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full py-7 rounded-2xl text-base font-black uppercase tracking-wider"
                                isLoading={isSaving}
                                disabled={saveSuccess}
                            >
                                {saveSuccess ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <HiCheck className="w-5 h-5" /> Saved!
                                    </span>
                                ) : "Save Changes"}
                            </Button>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="notifications"
                        variants={containerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="space-y-6 pt-10 sm:pt-4"
                    >
                        <button
                            onClick={() => setActiveSection('none')}
                            className="flex items-center gap-2 text-gray-400 hover:text-teal-600 transition-colors font-bold text-xs uppercase tracking-widest group mb-8"
                        >
                            <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Settings
                        </button>

                        <header className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Notifications</h2>
                            <p className="text-gray-500 mt-1 font-medium">Stay updated on your group activities</p>
                        </header>

                        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                            <div className="space-y-5">
                                {[
                                    { id: 'expenseAdded', label: 'New Expense Added', desc: 'Notify when someone adds a new expense' },
                                    { id: 'groupInvite', label: 'Group Invites', desc: 'Notify when someone invites you to a group' },
                                    { id: 'settlementReceived', label: 'Settlements', desc: 'Notify when someone records a settlement' },
                                ].map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-5 bg-gray-50/50 rounded-2xl border border-gray-50">
                                        <div className="pr-4">
                                            <p className="font-bold text-gray-900 leading-none">{item.label}</p>
                                            <p className="text-[11px] text-gray-500 mt-1.5 font-medium">{item.desc}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={notifications[item.id as keyof typeof notifications]}
                                                onChange={(e) => setNotifications(prev => ({
                                                    ...prev,
                                                    [item.id]: e.target.checked
                                                }))}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={handleSaveNotifications}
                                className="w-full py-7 rounded-2xl text-base font-black uppercase tracking-wider"
                                isLoading={isSaving}
                                disabled={saveSuccess}
                            >
                                {saveSuccess ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <HiCheck className="w-5 h-5" /> Saved!
                                    </span>
                                ) : "Update Preferences"}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
