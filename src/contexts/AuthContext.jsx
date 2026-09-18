import { createContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Ambil profil dari Firestore
        try {
          const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data());
          }
        } catch (error) {
          console.error("Gagal ambil profil:", error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const profileDoc = await getDoc(doc(db, "users", result.user.uid));
    if (profileDoc.exists()) {
      setUserProfile(profileDoc.data());
    }
    return result;
  };

  const register = async (email, password, profileData) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Simpan profil ke Firestore
    const profile = {
      ...profileData,
      email,
      uid: result.user.uid,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", result.user.uid), profile);
    setUserProfile(profile);
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isRelawan: userProfile?.role === "relawan",
    isAdmin: userProfile?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
