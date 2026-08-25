import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { getMe, login as apiLogin, register as apiRegister } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "../components/AuthLayout";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import {
  isPasswordValid,
  passwordChecks,
  validateAge,
  validateEmail,
  validateName,
  validatePhone,
} from "../lib/validation";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  city: string;
  age: string;
  password: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  city: "",
  age: "",
  password: "",
};

const VALIDATORS: Record<string, (value: string) => string | undefined> = {
  first_name: validateName,
  last_name: validateName,
  city: validateName,
  email: validateEmail,
  phone_number: validatePhone,
  age: validateAge,
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="auth-field !mt-0" htmlFor={id}>
        <span>{label}</span>
        {children}
      </label>
      {error && (
        <p role="alert" className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-[#FFB4B4]">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return (
      <Navigate to={user.type === "admin" ? "/admin/users" : "/profile"} replace />
    );
  }

  const checks = passwordChecks(form.password);

  function setField(name: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleBlur(name: keyof FormState) {
    const msg =
      name === "password"
        ? isPasswordValid(checks)
          ? undefined
          : "Password does not meet all requirements"
        : VALIDATORS[name]?.(form[name]);
    setErrors((prev) => ({ ...prev, [name]: msg }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors = {};
    (Object.keys(VALIDATORS) as Array<keyof FormState>).forEach((name) => {
      const msg = VALIDATORS[name](form[name]);
      if (msg) nextErrors[name] = msg;
    });
    if (!isPasswordValid(checks))
      nextErrors.password = "Password does not meet all requirements";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    try {
      await apiRegister({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number.trim(),
        city: form.city.trim(),
        age: Number(form.age),
        password: form.password,
      });
      const tokenResponse = await apiLogin(
        form.email.trim().toLowerCase(),
        form.password,
      );
      localStorage.setItem("usersys_token", tokenResponse.access_token);
      const me = await getMe();
      login(tokenResponse.access_token, me);
      navigate("/profile");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409)
          setErrors((prev) => ({ ...prev, email: err.message }));
        else if (Object.keys(err.fieldErrors).length > 0)
          setErrors(err.fieldErrors as FieldErrors);
        else setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout compact>
      <div className="auth-compact">
        <h1 className="auth-title-sm">CREATE ACCOUNT</h1>

        {formError && (
          <div role="alert" className="auth-alert-error mt-3">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-2 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first_name" label="First name" error={errors.first_name}>
              <input
                id="first_name"
                type="text"
                placeholder="John"
                value={form.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
                onBlur={() => handleBlur("first_name")}
                className={errors.first_name ? "has-error" : ""}
              />
            </Field>

            <Field id="last_name" label="Last name" error={errors.last_name}>
              <input
                id="last_name"
                type="text"
                placeholder="Doe"
                value={form.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
                onBlur={() => handleBlur("last_name")}
                className={errors.last_name ? "has-error" : ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" error={errors.email}>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={errors.email ? "has-error" : ""}
              />
            </Field>

            <Field id="phone_number" label="Phone" error={errors.phone_number}>
              <input
                id="phone_number"
                type="tel"
                placeholder="+96170123456"
                value={form.phone_number}
                onChange={(e) => setField("phone_number", e.target.value)}
                onBlur={() => handleBlur("phone_number")}
                className={errors.phone_number ? "has-error" : ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="city" label="City" error={errors.city}>
              <input
                id="city"
                type="text"
                placeholder="Tripoli"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                onBlur={() => handleBlur("city")}
                className={errors.city ? "has-error" : ""}
              />
            </Field>

            <Field id="age" label="Age" error={errors.age}>
              <input
                id="age"
                type="number"
                min={13}
                max={120}
                placeholder="25"
                value={form.age}
                onChange={(e) => setField("age", e.target.value)}
                onBlur={() => handleBlur("age")}
                className={errors.age ? "has-error" : ""}
              />
            </Field>
          </div>

          <div>
            <label className="auth-field !mt-0" htmlFor="password">
              <span>Password</span>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choose a strong password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  className={`!pr-16 ${errors.password ? "has-error" : ""}`}
                />
                <button
                  className="auth-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>
            <PasswordStrengthMeter password={form.password} onDark />
            {errors.password && (
              <p role="alert" className="mt-1 flex items-center gap-1 text-[12px] leading-4 text-[#FFB4B4]">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {errors.password}
              </p>
            )}
          </div>

          <button className="auth-btn mt-1" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#00523F]/30 border-t-[#00523F]" />
                Creating…
              </>
            ) : (
              "SIGN UP"
            )}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
