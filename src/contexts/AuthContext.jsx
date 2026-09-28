import { createContext, useState, useEffect, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { getHomeRouteForRole } from "../lib/authRoles";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileState, setProfileState] = useState({ uid: null, status: "loading", profile: null, issue: null });
  const [loading, setLoading] = useState(true);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (firebaseUser) => {
    const request = ++profileRequest.current;
    const uid = firebaseUser.uid;
    const current = () => request === profileRequest.current && auth.currentUser?.uid === uid;
    const ready = (profile) => !!getHomeRouteForRole(profile?.role);
    setProfileState((previous) => previous.uid === uid && previous.status === "ready"
      ? previous : { uid, status: "loading", profile: null, issue: null });

    const reference = doc(db, "users", uid);
    const restoreCachedProfile = async () => {
      try {
        const cached = await getDocFromCache(reference);
        if (current() && cached.exists() && ready(cached.data())) {
          setProfileState({ uid, status: "ready", profile: cached.data(), issue: null });
          return true;
        }
      } catch {
        // The device may never have loaded this profile while online.
      }
      return false;
    };

    if (!navigator.onLine) {
      const restored = await restoreCachedProfile();
      if (current() && !restored) setProfileState((previous) => previous.uid === uid && previous.status === "ready"
        ? previous : { uid, status: "unavailable", profile: null, issue: "offline" });
      return;
    }

    try {
      // A stalled network request must not leave a first-time device on a spinner forever.
      let timeout;
      const snapshot = await Promise.race([
        getDocFromServer(reference),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Profil tidak dapat dihubungi.")), 10000);
        }),
      ]).finally(() => clearTimeout(timeout));
      if (!current()) return;
      if (!snapshot.exists()) {
        setProfileState({ uid, status: "unavailable", profile: null, issue: "missing" });
      } else if (!ready(snapshot.data())) {
        setProfileState({ uid, status: "unavailable", profile: null, issue: "invalid" });
      } else {
        setProfileState({ uid, status: "ready", profile: snapshot.data(), issue: null });
      }
    } catch (error) {
      console.error("Gagal ambil profil:", error);
      const restored = await restoreCachedProfile();
      if (current() && !restored) setProfileState((previous) => previous.uid === uid && previous.status === "ready"
        ? previous : { uid, status: "unavailable", profile: null, issue: navigator.onLine ? "network" : "offline" });
    }
  }, []);

  useEffect(() => {
    const requestTracker = profileRequest;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        void loadProfile(firebaseUser);
      } else {
        requestTracker.current++;
        setUser(null);
        setProfileState({ uid: null, status: "loading", profile: null, issue: null });
      }
      setLoading(false);
    });

    return () => {
      requestTracker.current++;
      unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, profileData) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (!result.user.email) throw new Error("Email akun Firebase tidak tersedia.");
    // Simpan profil ke Firestore
    const profile = {
      ...profileData,
      role: "relawan",
      email: result.user.email,
      uid: result.user.uid,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", result.user.uid), profile);
    profileRequest.current++;
    setProfileState({ uid: result.user.uid, status: "ready", profile, issue: null });
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    profileRequest.current++;
    setUser(null);
    setProfileState({ uid: null, status: "loading", profile: null, issue: null });
  };

  const userProfile = user && profileState.uid === user.uid && profileState.status === "ready"
    ? profileState.profile : null;

  const value = {
    user,
    userProfile,
    loading,
    profileLoading: !!user && (profileState.uid !== user.uid || profileState.status === "loading"),
    profileIssue: profileState.uid === user?.uid ? profileState.issue : null,
    retryProfile: () => auth.currentUser ? loadProfile(auth.currentUser) : Promise.resolve(),
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isRelawan: userProfile?.role === "relawan",
    isNakes: userProfile?.role === "nakes",
    isAdmin: userProfile?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
