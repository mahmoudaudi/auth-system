import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import type { UserOut } from "../api/endpoints";
import { avatarUrl, removeAvatar, updateMe, uploadAvatar } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import TextField from "../components/TextField";
import {
  isPasswordValid,
  passwordChecks,
  validateAge,
  validateEmail,
  validateName,
  validatePhone,
} from "../lib/validation";

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  city: string;
  age: string;
}

type FieldErrors = Partial<Record<keyof ProfileForm | "password", string>>;

function formFromUser(user: UserOut): ProfileForm {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone_number: user.phone_number,
    city: user.city,
    age: String(user.age),
  };
}

const VALIDATORS: Record<string, (value: string) => string | undefined> = {
  first_name: validateName,
  last_name: validateName,
  city: validateName,
  email: validateEmail,
  phone_number: validatePhone,
  age: validateAge,
};

export default function ProfilePage() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>(() => formFromUser(user!));
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(formFromUser(user!)) ||
      newPassword.length > 0,
    [form, newPassword, user],
  );

  const initials =
    `${user!.first_name[0] ?? ""}${user!.last_name[0] ?? ""}`.toUpperCase();

  function setField(name: keyof ProfileForm, value: string) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setSuccess(false);
    if (errors[name])
      setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function handleBlur(name: keyof ProfileForm) {
    const message = VALIDATORS[name]?.(form[name]);
    setErrors((previous) => ({ ...previous, [name]: message }));
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setAvatarUploading(true);
    try {
      const updated = await uploadAvatar(file);
      login(token!, updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    try {
      const updated = await removeAvatar();
      login(token!, updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || loading) return;
    setFormError(null);
    setSuccess(false);

    const nextErrors: FieldErrors = {};
    (Object.keys(VALIDATORS) as Array<keyof ProfileForm>).forEach((name) => {
      const message = VALIDATORS[name](form[name]);
      if (message) nextErrors[name] = message;
    });
    if (newPassword && !isPasswordValid(passwordChecks(newPassword)))
      nextErrors.password = "New password does not meet all requirements yet";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number.trim(),
        city: form.city.trim(),
        age: Number(form.age),
      };
      if (newPassword) payload.password = newPassword;

      const updated = await updateMe(payload);
      login(token!, updated);
      setNewPassword("");
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0)
          setErrors(err.fieldErrors as FieldErrors);
        else setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Update failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const memberSince = new Date(user!.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Profile header */}
        <div className="mb-8 flex items-center gap-5">
          <div
            className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary transition-opacity duration-200"
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            role="button"
            aria-label="Change avatar"
          >
            {avatarUrl(user!.avatar_url) ? (
              <img
                src={avatarUrl(user!.avatar_url)!}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-mono text-lg font-bold text-on-primary">{initials}</span>
            )}

            {/* Camera overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {avatarUploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-[22px]">photo_camera</span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          {user!.avatar_url && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={avatarUploading}
              className="rounded-md border border-surface-border px-2 py-1 text-[11px] text-outline transition-colors hover:border-error hover:text-error"
            >
              Remove photo
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-headline-lg font-normal text-heading">
              {user!.first_name} {user!.last_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  user!.type === "admin"
                    ? "bg-accent-soft text-accent"
                    : "bg-primary-soft text-primary"
                }`}
              >
                {user!.type}
              </span>
              <span className="font-mono text-body-sm text-on-surface-variant">
                {user!.email}
              </span>
              <span className="text-body-sm text-outline">·</span>
              <span className="text-body-sm text-outline">{memberSince}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Left sidebar */}
          <div className="flex flex-col gap-4">
            <div className="card p-5">
              <h3 className="mb-3 text-label-caps text-outline">ACCOUNT INFO</h3>
              <div className="space-y-2.5 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Location</span>
                  <span className="font-medium text-heading">{user!.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Phone</span>
                  <span className="font-mono text-heading">{user!.phone_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Age</span>
                  <span className="font-medium text-heading">{user!.age}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">User ID</span>
                  <span className="font-mono text-outline">#{user!.id}</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-2 text-label-caps text-outline">SESSION</h3>
              <p className="mb-3 text-body-sm text-on-surface-variant">
                Sign out of your account.
              </p>
              <div className="flex flex-col gap-2">
                {user!.type === "admin" && (
                  <button
                    type="button"
                    onClick={() => navigate("/admin/users")}
                    className="w-full rounded-lg border border-surface-border px-4 py-2 text-body-sm font-semibold text-heading transition-colors duration-150 hover:border-primary hover:text-primary"
                  >
                    Manage users
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { logout(); navigate("/login"); }}
                  className="w-full rounded-lg border border-error/30 px-4 py-2 text-body-sm font-semibold text-error transition-colors duration-150 hover:bg-error-container"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          {/* Right: edit form */}
          <div className="card p-5 sm:p-6">
            <h2 className="mb-4 text-headline-md font-semibold text-heading">
              Edit profile
            </h2>

            {formError && (
              <div role="alert" className="alert-error mb-4">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {formError}
              </div>
            )}
            {success && (
              <div role="status" className="alert-success mb-4">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Profile updated.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <TextField
                  id="first_name"
                  label="First name"
                  value={form.first_name}
                  error={errors.first_name}
                  onChange={(event) => setField("first_name", event.target.value)}
                  onBlur={() => handleBlur("first_name")}
                />
                <TextField
                  id="last_name"
                  label="Last name"
                  value={form.last_name}
                  error={errors.last_name}
                  onChange={(event) => setField("last_name", event.target.value)}
                  onBlur={() => handleBlur("last_name")}
                />
                <TextField
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  error={errors.email}
                  onChange={(event) => setField("email", event.target.value)}
                  onBlur={() => handleBlur("email")}
                />
                <TextField
                  id="phone_number"
                  label="Phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone_number}
                  error={errors.phone_number}
                  onChange={(event) => setField("phone_number", event.target.value)}
                  onBlur={() => handleBlur("phone_number")}
                />
                <TextField
                  id="city"
                  label="City"
                  value={form.city}
                  error={errors.city}
                  onChange={(event) => setField("city", event.target.value)}
                  onBlur={() => handleBlur("city")}
                />
                <TextField
                  id="age"
                  label="Age"
                  type="number"
                  min={13}
                  max={120}
                  value={form.age}
                  error={errors.age}
                  onChange={(event) => setField("age", event.target.value)}
                  onBlur={() => handleBlur("age")}
                />
                <div className="sm:col-span-2">
                  <TextField
                    id="new-password"
                    label="New password"
                    helperText="Leave empty to keep current"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    error={errors.password}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setSuccess(false);
                      if (errors.password)
                        setErrors((previous) => ({ ...previous, password: undefined }));
                    }}
                  />
                  <PasswordStrengthMeter password={newPassword} />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-surface-border pt-4">
                <button
                  type="button"
                  disabled={!dirty || loading}
                  onClick={() => {
                    setForm(formFromUser(user!));
                    setNewPassword("");
                    setErrors({});
                    setFormError(null);
                  }}
                  className="btn-ghost disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={!dirty || loading}
                  className="btn-primary py-2"
                >
                  {loading ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
