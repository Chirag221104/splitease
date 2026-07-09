"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, setDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { checkUsernameAvailability } from "@/lib/firestore";
import { User, Group, Expense, Settlement } from "@/types";
import { motion } from "framer-motion";
import { HiUser, HiArrowRight, HiShieldCheck, HiCheckCircle, HiXCircle } from "react-icons/hi";

export default function GuestJoinPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [dummyUser, setDummyUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [claiming, setClaiming] = useState(false);
    const [anonUid, setAnonUid] = useState<string | null>(null);
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");
    const [validationError, setValidationError] = useState("");
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        // Step 1: Sign in anonymously first (required to read Firestore),
        // then fetch the dummy user doc.
        const init = async () => {
            try {
                // Check if already signed in
                const currentUser = auth.currentUser;
                let uid: string;

                if (currentUser) {
                    uid = currentUser.uid;
                } else {
                    const cred = await signInAnonymously(auth);
                    uid = cred.user.uid;
                }

                setAnonUid(uid);

                // Now we can read Firestore
                const docRef = doc(db, "users", token);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as User;
                    if (data.isDummy) {
                        setDummyUser(data);
                    } else {
                        setError("This guest link has already been claimed.");
                    }
                } else {
                    setError("Invalid or expired guest link.");
                }
            } catch (err: any) {
                console.error("Error during guest init:", err);
                setError("Failed to verify guest link. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [token]);

    // Live Debounced Username Checking
    useEffect(() => {
        const checkAvailability = async (u: string) => {
            if (u.length < 3) {
                setUsernameAvailable(null);
                setValidationError("Username must be at least 3 characters.");
                setCheckingUsername(false);
                return;
            }

            try {
                const available = await checkUsernameAvailability(u);
                setUsernameAvailable(available);
                if (!available) {
                    setValidationError("Username is already taken.");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setCheckingUsername(false);
            }
        };

        if (username) {
            setCheckingUsername(true);
            setValidationError("");
            setUsernameAvailable(null);
            
            const debounceTimer = setTimeout(() => {
                checkAvailability(username);
            }, 500); // 500ms debounce
            
            return () => clearTimeout(debounceTimer);
        } else {
            setUsernameAvailable(null);
            setValidationError("");
            setCheckingUsername(false);
        }
    }, [username]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dummyUser || !anonUid) return;
        
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername.length < 3) {
            setValidationError("Username must be at least 3 characters.");
            return;
        }

        setClaiming(true);
        setError("");
        setValidationError("");

        try {
            // We can trust the live validation state if it's explicitly true
            if (usernameAvailable === false) {
                setValidationError("Username is already taken. Please choose another.");
                setClaiming(false);
                return;
            }

            // Fallback check just in case
            if (usernameAvailable === null) {
                const available = await checkUsernameAvailability(cleanUsername);
                if (!available) {
                    setValidationError("Username is already taken. Please choose another.");
                    setClaiming(false);
                    return;
                }
            }

            const batch = writeBatch(db);

            // 1. Create the new user profile for this anonUid
            const newUserRef = doc(db, "users", anonUid);
            
            // Use set (not batch.set) to create the user doc immediately,
            // so the AuthContext's onAuthStateChanged doesn't race with us.
            await setDoc(newUserRef, {
                uid: anonUid,
                email: null,
                displayName: dummyUser.displayName,
                username: cleanUsername,
                photoURL: null,
                phoneNumber: phone.trim() || null,
                isDummy: false,
                groups: dummyUser.groups || [],
                createdAt: serverTimestamp()
            });

            // 2. Update all groups to replace dummy ID with anonUid
            if (dummyUser.groups && dummyUser.groups.length > 0) {
                for (const groupId of dummyUser.groups) {
                    const groupRef = doc(db, "groups", groupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        const groupData = groupSnap.data() as Group;
                        const newMembersArray: string[] = groupData.members.map((m: string) => m === token ? anonUid : m);
                        if (!newMembersArray.includes(anonUid)) newMembersArray.push(anonUid);
                        batch.update(groupRef, { members: newMembersArray });

                        // 3. Update expenses in this group
                        const expensesQuery = query(collection(db, "expenses"), where("groupId", "==", groupId));
                        const expensesSnap = await getDocs(expensesQuery);

                        expensesSnap.docs.forEach(expDoc => {
                            const expData = expDoc.data() as Expense;
                            let needsUpdate = false;
                            const updateData: any = {};

                            if (expData.paidBy === token) {
                                updateData.paidBy = anonUid;
                                needsUpdate = true;
                            }
                            if (expData.createdBy === token) {
                                updateData.createdBy = anonUid;
                                needsUpdate = true;
                            }
                            if (expData.contributors && expData.contributors[token] !== undefined) {
                                updateData.contributors = { ...expData.contributors };
                                updateData.contributors[anonUid] = updateData.contributors[token];
                                delete updateData.contributors[token];
                                needsUpdate = true;
                            }
                            if (expData.splits) {
                                const newSplits = expData.splits.map(s => {
                                    if (s.userId === token) {
                                        needsUpdate = true;
                                        return { ...s, userId: anonUid };
                                    }
                                    return s;
                                });
                                if (needsUpdate) updateData.splits = newSplits;
                            }

                            if (needsUpdate) {
                                batch.update(expDoc.ref, updateData);
                            }
                        });

                        // 4. Update settlements
                        const settlementsQuery = query(collection(db, "settlements"), where("groupId", "==", groupId));
                        const settlementsSnap = await getDocs(settlementsQuery);

                        settlementsSnap.docs.forEach(settleDoc => {
                            const settleData = settleDoc.data() as Settlement;
                            let needsUpdate = false;
                            const updateData: any = {};

                            if (settleData.fromUser === token) {
                                updateData.fromUser = anonUid;
                                needsUpdate = true;
                            }
                            if (settleData.toUser === token) {
                                updateData.toUser = anonUid;
                                needsUpdate = true;
                            }

                            if (needsUpdate) {
                                batch.update(settleDoc.ref, updateData);
                            }
                        });
                    }
                }
            }

            // 5. Delete the old dummy user
            const oldUserRef = doc(db, "users", token);
            batch.delete(oldUserRef);

            // Execute the migration!
            await batch.commit();

            // Refresh global auth state so it picks up the new username
            await refreshUser();

            // Success — navigate to dashboard
            router.push("/dashboard");
        } catch (err: any) {
            console.error("Migration failed:", err);
            setError("Failed to claim account. Please try again.");
            setClaiming(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !dummyUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center border border-rose-100">
                    <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <HiShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-gray-800 transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-gray-100 relative z-10"
            >
                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <HiUser className="w-10 h-10" />
                </div>

                <h1 className="text-3xl font-black text-gray-900 text-center mb-2 italic">
                    Welcome, {dummyUser.displayName}!
                </h1>
                <p className="text-gray-500 text-center mb-6 font-medium">
                    You've been invited to view and add expenses for your group trip. Set up your profile to join!
                </p>

                <form onSubmit={handleJoin} className="space-y-4 mb-6">
                    <div>
                        <div className="relative">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                }}
                                placeholder="Choose a username"
                                className={`w-full pl-4 pr-10 py-3 rounded-xl border ${usernameAvailable === false ? 'border-rose-300 focus:ring-rose-500' : usernameAvailable === true ? 'border-teal-300 focus:ring-teal-500' : 'border-gray-200 focus:ring-teal-500'} focus:ring-2 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white`}
                                required
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                {checkingUsername && (
                                    <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                                {!checkingUsername && usernameAvailable === true && (
                                    <HiCheckCircle className="w-6 h-6 text-teal-500" />
                                )}
                                {!checkingUsername && usernameAvailable === false && (
                                    <HiXCircle className="w-6 h-6 text-rose-500" />
                                )}
                            </div>
                        </div>
                        {validationError && (
                            <p className="text-rose-500 text-xs font-bold mt-2 ml-1">{validationError}</p>
                        )}
                    </div>
                    <div>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Mobile Number (Optional)"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={claiming}
                        className="w-full bg-teal-600 text-white h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-teal-600/20 hover:bg-teal-700 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 mt-2"
                    >
                        {claiming ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Join as Guest <HiArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center mt-6">
                    You can upgrade to a permanent account later
                </p>
            </motion.div>
        </div>
    );
}
