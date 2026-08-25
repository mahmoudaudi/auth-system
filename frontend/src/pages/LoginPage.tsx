import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getMe, login as apiLogin } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { useToast } from "../components/ToastContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  if (user) {
    return (
      <Navigate to={user.type === "admin" ? "/admin/users" : "/profile"} replace />
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const tokenResponse = await apiLogin(email.trim(), password);
      localStorage.setItem("usersys_token", tokenResponse.access_token);
      const me = await getMe();
      login(tokenResponse.access_token, me);
      addToast("success", `Welcome back, ${me.first_name}!`);
      navigate(me.type === "admin" ? "/admin/users" : "/profile");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="auth-title">WELCOME</h1>

        <form onSubmit={handleSubmit} noValidate>
          <label className="auth-field" htmlFor="login-email">
            <span>Email</span>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="auth-field" htmlFor="login-password">
            <span>Password</span>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              className="auth-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <span className="material-symbols-outlined text-[22px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </label>

          <button
            className="auth-btn mt-3"
            type="submit"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#00523F]/30 border-t-[#00523F]" />
                Logging in…
              </>
            ) : (
              "LOGIN"
            )}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <Link to="/register">Sign up</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
