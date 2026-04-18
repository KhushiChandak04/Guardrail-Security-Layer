import { useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

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
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("underdog-user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = () => {
    // TODO: implement real Google OAuth flow
    const fakeUser = {
      id: "u_001",
      name: "Demo User",
      email: "demo@underdog.ai",
      picture: null,
    };
    localStorage.setItem("underdog-user", JSON.stringify(fakeUser));
    // Mock token for API calls
    localStorage.setItem("underdog-token", "mock-jwt-token");
    setUser(fakeUser);
    setIsAuthenticated(true);
    navigate("/dashboard");
  };

  const loginWithForm = (formData) => {
    const name = formData?.fullName || "Underdog Member";
    const email = formData?.email || "member@underdog.ai";
    const fakeUser = {
      id: `u_${Date.now()}`,
      name,
      email,
      company: formData?.company || "",
      role: formData?.role || "",
      picture: null,
    };
    localStorage.setItem("underdog-user", JSON.stringify(fakeUser));
    localStorage.setItem("underdog-token", "mock-jwt-token");
    setUser(fakeUser);
    setIsAuthenticated(true);
    navigate("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("underdog-user");
    localStorage.removeItem("underdog-token");
    setUser(null);
    setIsAuthenticated(false);
    navigate("/");
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    loginWithGoogle,
    loginWithForm,
    logout,
  };
}
