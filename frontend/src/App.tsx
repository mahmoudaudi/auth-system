import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import AdminUsersPage from "./pages/AdminUsersPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.type === "admin" ? "/admin/users" : "/profile"} replace />;
}

/** Requires a signed-in user; admins only when `adminOnly`. */
function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.type !== "admin") return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-on-surface antialiased">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth adminOnly>
              <AdminUsersPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </div>
  );
}
