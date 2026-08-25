import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import type { ListUsersParams, UserOut } from "../api/endpoints";
import {
  adminCreateUser,
  adminUpdateUser,
  deleteUser,
  getAverageAge,
  getTopCities,
  getUsersCount,
  listUsers,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import TextField from "../components/TextField";
import { useToast } from "../components/ToastContext";
import {
  isPasswordValid,
  passwordChecks,
  validateAge,
  validateEmail,
  validateName,
  validatePhone,
} from "../lib/validation";

// ---------- helpers ----------

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function initialsOf(user: Pick<UserOut, "first_name" | "last_name">) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TypeBadge({ type }: { type: "admin" | "client" }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        type === "admin" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary"
      }`}
    >
      {type}
    </span>
  );
}

const FIELD_VALIDATORS: Record<string, (value: string) => string | undefined> = {
  first_name: validateName,
  last_name: validateName,
  city: validateName,
  email: validateEmail,
  phone_number: validatePhone,
  age: validateAge,
};

interface UserFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  city: string;
  age: string;
  type: "admin" | "client";
  password: string;
}

type FormErrors = Partial<Record<keyof UserFormState, string>>;

// ---------- create/edit modal ----------

interface FormModalProps {
  mode: "create" | "edit";
  user?: UserOut;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ mode, user, onClose, onSaved }: FormModalProps) {
  const [form, setForm] = useState<UserFormState>(() =>
    user
      ? {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone_number: user.phone_number,
          city: user.city,
          age: String(user.age),
          type: user.type,
          password: "",
        }
      : {
          first_name: "",
          last_name: "",
          email: "",
          phone_number: "",
          city: "",
          age: "",
          type: "client",
          password: "",
        },
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const checks = passwordChecks(form.password);

  function setField(name: keyof UserFormState, value: string) {
    setForm((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    (Object.keys(FIELD_VALIDATORS) as Array<keyof UserFormState>).forEach((name) => {
      const message = FIELD_VALIDATORS[name](form[name]);
      if (message) nextErrors[name] = message;
    });
    if (!user && !isPasswordValid(checks)) {
      nextErrors.password = "Password does not meet all requirements yet";
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    const base = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone_number: form.phone_number.trim(),
      city: form.city.trim(),
      age: Number(form.age),
      type: form.type,
    };

    try {
      if (mode === "create") {
        await adminCreateUser({ ...base, password: form.password });
        addToast("success", "User created successfully!");
      } else {
        await adminUpdateUser(user!.id, {
          ...base,
          ...(form.password ? { password: form.password } : {}),
        });
        addToast("success", "User updated successfully!");
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrors((previous) => ({ ...previous, email: err.message }));
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors as FormErrors);
        } else {
          addToast("error", err.message);
        }
      } else {
        addToast("error", err instanceof Error ? err.message : "Request failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "Add user" : `Edit ${user!.first_name}`} onClose={onClose}>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <TextField
            id="m-first"
            label="First name"
            value={form.first_name}
            error={errors.first_name}
            onChange={(event) => setField("first_name", event.target.value)}
            onBlur={() => setField("first_name", form.first_name)}
          />
          <TextField
            id="m-last"
            label="Last name"
            value={form.last_name}
            error={errors.last_name}
            onChange={(event) => setField("last_name", event.target.value)}
            onBlur={() => setField("last_name", form.last_name)}
          />
          <TextField
            id="m-email"
            label="Email"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(event) => setField("email", event.target.value)}
            onBlur={() => setField("email", form.email)}
          />
          <TextField
            id="m-phone"
            label="Phone number"
            type="tel"
            value={form.phone_number}
            error={errors.phone_number}
            onChange={(event) => setField("phone_number", event.target.value)}
            onBlur={() => setField("phone_number", form.phone_number)}
          />
          <TextField
            id="m-city"
            label="City"
            value={form.city}
            error={errors.city}
            onChange={(event) => setField("city", event.target.value)}
            onBlur={() => setField("city", form.city)}
          />
          <TextField
            id="m-age"
            label="Age"
            type="number"
            min={13}
            max={120}
            value={form.age}
            error={errors.age}
            onChange={(event) => setField("age", event.target.value)}
            onBlur={() => setField("age", form.age)}
          />

          {/* Role select */}
          <div className="sm:col-span-2">
            <label htmlFor="m-type" className="text-[12px] font-medium text-on-surface-variant">
              Role
            </label>
            <select
              id="m-type"
              value={form.type}
              onChange={(event) => setField("type", event.target.value)}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-body-sm text-on-surface outline-none transition-colors duration-200 focus:border-secondary focus:ring-2 focus:ring-secondary/25"
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Password: required on create, optional on edit */}
          <div className="sm:col-span-2">
            <TextField
              id="m-password"
              label={mode === "create" ? "Password" : "New password"}
              type="password"
              autoComplete="new-password"
              placeholder={mode === "create" ? "Choose a strong password" : "Leave empty to keep current"}
              value={form.password}
              error={errors.password}
              onChange={(event) => setField("password", event.target.value)}
            />
            <PasswordStrengthMeter password={form.password} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3 border-t border-surface-border pt-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- main page ----------

export default function AdminUsersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // list state
  const [rows, setRows] = useState<UserOut[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [typeFilter, setTypeFilter] = useState<"admin" | "client" | "">("");
  const debouncedSearch = useDebounced(search);
  const debouncedCity = useDebounced(city);

  // stats strip
  const [statsTotal, setStatsTotal] = useState<number | null>(null);
  const [avgAge, setAvgAge] = useState<number | null>(null);
  const [topCities, setTopCities] = useState<Array<{ city: string; count: number }>>([]);

  // modals
  const [formModal, setFormModal] = useState<
    { mode: "create" } | { mode: "edit"; user: UserOut } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<UserOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasFilters =
    debouncedSearch !== "" || debouncedCity !== "" || typeFilter !== "";

  const loadStats = useCallback(() => {
    getUsersCount()
      .then((data) => setStatsTotal(data.total_users))
      .catch(() => undefined);
    getAverageAge()
      .then((data) => setAvgAge(data.average_age))
      .catch(() => undefined);
    getTopCities()
      .then((data) => setTopCities(data.cities))
      .catch(() => undefined);
  }, []);

  const loadList = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const params: ListUsersParams = { page: targetPage, limit };
        if (debouncedSearch.trim().length >= (debouncedSearch.includes("@") ? 3 : 1)) {
          if (debouncedSearch.includes("@")) params.email = debouncedSearch.trim();
          else params.first_name = debouncedSearch.trim();
        }
        if (debouncedCity.trim()) params.city = debouncedCity.trim();
        if (typeFilter) params.type = typeFilter;

        const data = await listUsers(params);
        setRows(data.users);
        setTotal(data.total);
        setTotalPages(data.total_pages);
        setPage(data.page);
      } catch (err) {
        addToast("error", err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [limit, debouncedSearch, debouncedCity, typeFilter],
  );

  useEffect(() => {
    loadList(page);
  }, [loadList, page]);

  useEffect(() => {
    setPage(1); // any filter/limit change resets pagination
  }, [debouncedSearch, debouncedCity, typeFilter, limit]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      addToast("success", "User deleted.");
      setDeleteTarget(null);
      await loadList(page);
      loadStats();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  const pageButtons = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    for (let p = start; p < start + 3 && p <= totalPages; p++) pages.push(p);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-background">

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Heading */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-headline-lg font-normal text-heading">User management</h1>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">
              {user?.first_name}'s workspace — manage accounts, roles, and access.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate("/profile")} className="btn-ghost">
              My profile
            </button>
            <button
              type="button"
              onClick={() => { logout(); navigate("/login"); }}
              className="btn-ghost hover:border-error hover:text-error"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={() => setFormModal({ mode: "create" })}
              className="btn-primary flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add user
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-3.5 p-4">
            <div className="stat-icon bg-primary-soft text-primary">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
            <div>
              <p className="text-label-caps text-outline">TOTAL USERS</p>
              <p className="text-headline-md font-bold tabular-nums text-heading">{statsTotal ?? "—"}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3.5 p-4">
            <div className="stat-icon bg-accent-soft text-accent">
              <span className="material-symbols-outlined text-[22px]">cake</span>
            </div>
            <div>
              <p className="text-label-caps text-outline">AVERAGE AGE</p>
              <p className="text-headline-md font-bold tabular-nums text-heading">{avgAge ?? "—"}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3.5 p-4">
            <div className="stat-icon bg-success/10 text-success">
              <span className="material-symbols-outlined text-[22px]">location_city</span>
            </div>
            <div className="min-w-0">
              <p className="text-label-caps text-outline">TOP CITIES</p>
              <p className="truncate text-body-sm font-semibold text-heading">
                {topCities.length > 0
                  ? topCities.map((entry) => `${entry.city} (${entry.count})`).join(", ")
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Filters toolbar */}
        <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="f-search" className="text-[12px] font-medium text-on-surface-variant">
              Search
            </label>
            <input
              id="f-search"
              type="text"
              placeholder="Name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-body-sm outline-none transition-colors duration-200 placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20"
            />
          </div>
          <div className="min-w-[140px]">
            <label htmlFor="f-city" className="text-[12px] font-medium text-on-surface-variant">
              City
            </label>
            <input
              id="f-city"
              type="text"
              placeholder="Exact name…"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-body-sm outline-none transition-colors duration-200 placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20"
            />
          </div>
          <div className="w-36">
            <label htmlFor="f-type" className="text-[12px] font-medium text-on-surface-variant">
              Role
            </label>
            <select
              id="f-type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-body-sm outline-none transition-colors duration-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20"
            >
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="client">Clients</option>
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setCity(""); setTypeFilter(""); }}
              className="btn-ghost hover:border-error hover:text-error"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[760px] text-left text-body-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-label-caps text-outline">USER</th>
                  <th className="px-4 py-2.5 text-label-caps text-outline">ROLE</th>
                  <th className="px-4 py-2.5 text-label-caps text-outline">CITY</th>
                  <th className="px-4 py-2.5 text-label-caps text-outline">PHONE</th>
                  <th className="px-4 py-2.5 text-label-caps text-outline">AGE</th>
                  <th className="px-4 py-2.5 text-label-caps text-outline">JOINED</th>
                  <th className="px-4 py-2.5 text-right text-label-caps text-outline">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="skeleton h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <span className="material-symbols-outlined mx-auto mb-2 block text-[32px] text-outline-variant">
                        person_off
                      </span>
                      <p className="font-semibold text-heading">No users found</p>
                      <p className="text-on-surface-variant">
                        {hasFilters
                          ? "Try adjusting or clearing your filters."
                          : "The system has no active users yet."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors duration-150 hover:bg-primary-soft/20"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                            {initialsOf(row)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-heading">
                              {row.first_name} {row.last_name}
                            </p>
                            <p className="truncate text-[11px] text-on-surface-variant">{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><TypeBadge type={row.type} /></td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{row.city}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-on-surface-variant">{row.phone_number}</td>
                      <td className="px-4 py-2.5 tabular-nums text-on-surface-variant">{row.age}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-on-surface-variant">{shortDate(row.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${row.email}`}
                            onClick={() => setFormModal({ mode: "edit", user: row })}
                            className="cursor-pointer rounded-lg p-1.5 text-outline transition-colors duration-200 hover:bg-primary-soft hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${row.email}`}
                            disabled={row.id === user?.id}
                            title={row.id === user?.id ? "You cannot delete yourself" : undefined}
                            onClick={() => setDeleteTarget(row)}
                            className="cursor-pointer rounded-lg p-1.5 text-outline transition-colors duration-200 hover:bg-error-container hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-outline"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {!loading && rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-4 py-2.5">
              <p className="text-label-sm tabular-nums text-on-surface-variant">
                Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{" "}
                <strong>{total}</strong>
              </p>

              <div className="flex items-center gap-1">
                <select
                  aria-label="Users per page"
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  className="cursor-pointer rounded-lg border border-surface-border bg-surface px-2 py-1 text-label-sm text-on-surface-variant outline-none focus:border-secondary"
                >
                  {[10, 25, 50].map((value) => (
                    <option key={value} value={value}>{value} / page</option>
                  ))}
                </select>

                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="cursor-pointer rounded-lg border border-surface-border p-1.5 text-on-surface-variant transition-colors duration-200 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                {pageButtons.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === page ? "page" : undefined}
                    className={`h-8 min-w-8 cursor-pointer rounded-lg border px-2 text-label-sm font-medium transition-colors duration-200 ${
                      p === page
                        ? "border-primary bg-primary font-bold text-on-primary"
                        : "border-surface-border text-on-surface-variant hover:border-secondary hover:text-primary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="cursor-pointer rounded-lg border border-surface-border p-1.5 text-on-surface-variant transition-colors duration-200 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {formModal?.mode === "create" && (
        <UserFormModal
          mode="create"
          onClose={() => setFormModal(null)}
          onSaved={() => {
            loadList(page);
            loadStats();
          }}
        />
      )}
      {formModal?.mode === "edit" && (
        <UserFormModal
          mode="edit"
          user={formModal.user}
          onClose={() => setFormModal(null)}
          onSaved={() => {
            loadList(page);
          }}
        />
      )}
      {deleteTarget && (
        <Modal title="Delete user?" onClose={() => setDeleteTarget(null)} size="sm">
          <p className="text-body-sm text-on-surface-variant">
            You are about to permanently deactivate{" "}
            <strong className="text-heading">
              {deleteTarget.first_name} {deleteTarget.last_name}
            </strong>{" "}
            (<span className="font-mono tabular-nums">{deleteTarget.email}</span>). The account
            will no longer appear anywhere in the system.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer rounded-lg bg-error px-4 py-2 text-body-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
