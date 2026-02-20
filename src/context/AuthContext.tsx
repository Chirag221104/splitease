"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { User } from "@/types";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    logout: async () => { },
    refreshUser: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    /** 
     *  IMPORTANT FIX:
     *  loading should default to TRUE until Firebase finishes initial auth check
     */
    const [loading, setLoading] = useState(true);

    const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User> => {
        try {
            const userRef = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const newUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    createdAt: serverTimestamp(),
                };
                try {
                    await setDoc(userRef, newUser);
                } catch (error) {
                    console.error("Error creating user profile in Firestore:", error);
                    // Return basic user info if Firestore fails
                    return {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                    };
                }

                return {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                };
            }

            const firestoreData = userSnap.data();

            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                username: firestoreData.username,
                createdAt: firestoreData.createdAt,
            };
        } catch (error) {
            console.error("Error fetching user data from Firestore:", error);
            // Fallback to basic Firebase Auth data if Firestore is unreachable/denied
            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
            };
        }
    };

    const refreshUser = async () => {
        if (auth.currentUser) {
            const data = await fetchUserData(auth.currentUser);
            setUser(data);
        }
    };

    useEffect(() => {
        /** 
         *  IMPORTANT FIX:
         *  Prevent duplicate listeners during React Strict Mode (prod builds)
         */
        let unsubscribed = false;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (unsubscribed) return;

            try {
                if (firebaseUser) {
                    const data = await fetchUserData(firebaseUser);
                    setUser(data);
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error("Error in onAuthStateChanged:", error);
            } finally {
                setLoading(false); // only after Firebase finishes
            }
        });

        return () => {
            unsubscribed = true;
            unsubscribe();
        };
    }, []);

    /** FIX: Google popup breaks if triggered during redirect or loading */
    const signInWithGoogle = async () => {
        if (loading) return; // avoid multiple clicks

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Google login error:", err);
            throw err;
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
