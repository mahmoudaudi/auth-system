import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TOKEN_KEY } from "../api/client";
import type { UserOut } from "../api/endpoints";

interface AuthContextValue {
  user: UserOut | null;
  token: string | null;
  login: (token: string, user: UserOut) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): UserOut | null {
  try {
    const raw = localStorage.getItem("usersys_user");
    return raw ? (JSON.parse(raw) as UserOut) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<UserOut | null>(readStoredUser);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login: (newToken, newUser) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem("usersys_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("usersys_user");
        setToken(null);
        setUser(null);
      },
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
