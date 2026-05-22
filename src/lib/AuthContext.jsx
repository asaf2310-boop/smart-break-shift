import React, { createContext, useContext, useEffect, useState } from "react";
import { useSupabaseBackend } from "@/api/dataClient";
import { demoModeEnabled } from "@/api/demoClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  const finish = ({ demoAdmin = false, error = null } = {}) => {
    setUser(demoAdmin ? { id: "demo-admin", role: "admin", full_name: "מנהל דמו" } : null);
    setIsAuthenticated(demoAdmin);
    setAuthError(error);
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);
    setAuthError(null);

    if (demoModeEnabled) {
      finish({ demoAdmin: true });
      return;
    }

    if (useSupabaseBackend()) {
      finish({ demoAdmin: false });
      return;
    }

    finish({
      error: {
        type: "unknown",
        message: "לא הוגדר חיבור Supabase. אפשר להפעיל VITE_DEMO_MODE=true לסביבת דמו.",
      },
    });
  };

  useEffect(() => {
    checkAppState();
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = "/";
  };

  const navigateToLogin = () => {
    setAuthError(null);
  };

  const checkUserAuth = async () => {
    await checkAppState();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
