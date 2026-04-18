import { useEffect, useState, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";

import { getFirebaseAuth, syncAuthUserToFirestore } from "../services/firebase";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

function useAuthProvider() {
  const auth = getFirebaseAuth();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return () => {};
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, [auth]);

  const loginWithGoogle = async () => {
    if (!auth) {
      throw new Error("Firebase auth config is missing in frontend/.env");
    }

    const credentials = await signInWithPopup(auth, new GoogleAuthProvider());
    await syncAuthUserToFirestore(credentials.user);
    navigate("/dashboard");
    return credentials.user;
  };

  const loginWithForm = async (formData) => {
    if (!auth) {
      throw new Error("Firebase auth config is missing in frontend/.env");
    }

    const email = String(formData?.email || "").trim();
    const password = String(formData?.password || "").trim();
    const fullName = String(formData?.fullName || "").trim();
    const role = String(formData?.role || "user").trim() || "user";
    const mode = formData?.mode === "signup" ? "signup" : "login";

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    let signedInUser;
    if (mode === "signup") {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      signedInUser = credentials.user;

      if (fullName) {
        await updateProfile(credentials.user, { displayName: fullName });
      }
    } else {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      signedInUser = credentials.user;
    }

    await syncAuthUserToFirestore(signedInUser, role);
    navigate("/dashboard");
    return signedInUser;
  };

  const logout = async () => {
    if (!auth) {
      setUser(null);
      navigate("/");
      return;
    }

    await signOut(auth);
    navigate("/");
  };

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isFirebaseReady: Boolean(auth),
    loginWithGoogle,
    loginWithForm,
    logout,
  };
}
