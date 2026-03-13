"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getGroupDetails, getUsersByIds, getGroupExpenses, getGroupSettlements, recordSettlement } from "@/lib/firestore";
import { calculateGroupBalances, simplifyDebts } from "@/lib/calculations";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, Group } from "@/types";
import { motion } from "framer-motion";
import { HiArrowLeft, HiUser } from "react-icons/hi";
import { HiCurrencyRupee } from "react-icons/hi2";

function SettleUpForm({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<User[]>([]);
    const [payerId, setPayerId] = useState("");
    const [recipientId, setRecipientId] = useState("");
    const [amount, setAmount] = useState("");
    const [suggestedPayments, setSuggestedPayments] = useState<{ to: string, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const getUserName = (uid: string) => {
        const member = members.find(m => m.uid === uid);
        if (member?.uid === user?.uid) return "You";
        return member?.displayName || member?.email?.split('@')[0] || "Unknown";
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!id || !user) return;
            try {
                const groupData = await getGroupDetails(id);
                setGroup(groupData);

                if (groupData) {
                    const membersData = await getUsersByIds(groupData.members);
                    setMembers(membersData);

                    // Check URL search params first
                    const urlPayer = searchParams.get('payer');
                    const urlRecipient = searchParams.get('recipient');
                    const urlAmount = searchParams.get('amount');

                    if (urlPayer) setPayerId(urlPayer);
                    else setPayerId(user.uid);

                    if (urlRecipient) setRecipientId(urlRecipient);
                    if (urlAmount) setAmount(urlAmount);

                    // Calculate balances for suggestions
                    const expenses = await getGroupExpenses(id);
                    const settlements = await getGroupSettlements(id);

                    const calculatedBalances = calculateGroupBalances(expenses, settlements, groupData.members);
                    const simplified = simplifyDebts(calculatedBalances);

                    const myDebts = simplified
                        .filter(t => t.from === user.uid)
                        .map(t => ({ to: t.to, amount: t.amount }));

                    setSuggestedPayments(myDebts);

                    // Only set defaults if categories weren't in URL
                    if (!urlRecipient && myDebts.length > 0) {
                        setRecipientId(myDebts[0].to);
                        if (!urlAmount) setAmount(myDebts[0].amount.toFixed(2));
                    } else if (!urlRecipient) {
                        const firstOther = membersData.find(m => m.uid !== user.uid);
                        if (firstOther) setRecipientId(firstOther.uid);
                    }
                }
            } catch (error) {
                console.error("Error fetching settle up data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payerId || !recipientId || !amount) return;

        setSubmitting(true);
        try {
            await recordSettlement({
                groupId: id,
                fromUser: payerId,
                toUser: recipientId,
                amount: parseFloat(amount),
                date: Date.now()
            } as any);

            router.push(`/groups/${id}`);
        } catch (error) {
            console.error("Error recording settlement:", error);
            alert("Failed to record settlement");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Settle Up</p>
        </div>
    );

    if (!group) return <div className="p-8 text-center">Group not found</div>;

    return (
        <div className="max-w-md mx-auto pt-10 pb-20 px-4">
            <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-teal-600 font-black uppercase tracking-widest text-[10px] mb-10 transition-colors group"
            >
                <HiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Back to Group
            </motion.button>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full opacity-20 -mr-10 -mt-10"></div>

                <h1 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-3 italic relative z-10">
                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                        <HiUser className="text-teal-600 w-6 h-6 not-italic" />
                    </div>
                    Settle <span className="text-teal-600 not-italic">Up</span>
                </h1>

                {suggestedPayments.length > 0 && (
                    <div className="mb-10 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 relative z-10">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Suggested for you</h3>
                        <div className="space-y-3">
                            {suggestedPayments.map(payment => (
                                <motion.div
                                    key={payment.to}
                                    whileHover={{ x: 4 }}
                                    className="text-sm bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-teal-300 hover:shadow-md transition-all group"
                                    onClick={() => {
                                        setPayerId(user?.uid || "");
                                        setRecipientId(payment.to);
                                        setAmount(payment.amount.toFixed(2));
                                    }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs uppercase">
                                            {getUserName(payment.to).charAt(0)}
                                        </div>
                                        <span className="font-bold text-gray-700 group-hover:text-teal-600 transition-colors">Pay {getUserName(payment.to)}</span>
                                    </div>
                                    <span className="font-black text-teal-600">₹{payment.amount.toFixed(2)}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Paying Member</label>
                        <div className="relative">
                            <select
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                                className="w-full h-14 rounded-2xl border-2 border-gray-50 bg-gray-50 px-6 font-bold text-gray-900 focus:bg-white focus:border-teal-500 transition-all appearance-none cursor-pointer"
                            >
                                {members.map(member => (
                                    <option key={member.uid} value={member.uid}>
                                        {getUserName(member.uid)}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <span className="text-xs font-black uppercase tracking-widest">Change</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center -my-4 relative">
                        <div className="w-10 h-10 bg-white border-2 border-gray-50 rounded-full flex items-center justify-center text-teal-500 shadow-sm z-10">
                            <span className="text-lg font-black italic">to</span>
                        </div>
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-50 -translate-y-1/2"></div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Recipient</label>
                        <div className="relative">
                            <select
                                value={recipientId}
                                onChange={(e) => setRecipientId(e.target.value)}
                                className="w-full h-14 rounded-2xl border-2 border-gray-50 bg-gray-50 px-6 font-bold text-gray-900 focus:bg-white focus:border-teal-500 transition-all appearance-none cursor-pointer"
                            >
                                {members
                                    .filter(m => m.uid !== payerId)
                                    .map(member => (
                                        <option key={member.uid} value={member.uid}>
                                            {getUserName(member.uid)}
                                        </option>
                                    ))}
                            </select>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <span className="text-xs font-black uppercase tracking-widest">Change</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Amount (₹)</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-teal-600 italic">₹</span>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="h-16 pl-12 pr-6 text-2xl font-black rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-teal-500 transition-all placeholder:text-gray-300 shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full py-8 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl shadow-teal-100 hover:shadow-2xl transition-all"
                        isLoading={submitting}
                    >
                        Record Payment
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default function SettleUpPage(props: any) {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Settle Up</p>
            </div>
        }>
            <SettleUpForm {...props} />
        </Suspense>
    );
}
