import { BASE_URL, api, TOKEN_KEY } from "./client";

export interface UserOut {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  city: string;
  age: number;
  type: "admin" | "client";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ---- authentication ----
export const login = (email: string, password: string) =>
  api<TokenResponse>("/login", { method: "POST", body: { email, password } });

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  city: string;
  age: number;
  password: string;
}

export const register = (payload: RegisterPayload) =>
  api<UserOut>("/register", { method: "POST", body: payload });

export const checkEmail = (email: string) =>
  api<{ email: string; taken: boolean }>(`/check-email?email=${encodeURIComponent(email)}`);

export const getMe = () => api<UserOut>("/users/me", { auth: true });

/** All fields optional; only provided ones are sent. Never includes `type`. */
export type UpdateMePayload = Partial<RegisterPayload>;

export const updateMe = (payload: UpdateMePayload) =>
  api<UserOut>("/users/me", { method: "PUT", body: payload, auth: true });

// ---- admin: users CRUD ----
export interface ListUsersParams {
  page?: number;
  limit?: number;
  city?: string;
  type?: "admin" | "client" | "";
  age?: number | "";
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface PaginatedUsers {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  users: UserOut[];
}

export function listUsers(params: ListUsersParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return api<PaginatedUsers>(`/users${qs ? `?${qs}` : ""}`, { auth: true });
}

export type AdminCreateUserPayload = RegisterPayload & {
  type: "admin" | "client";
};

export const adminCreateUser = (payload: AdminCreateUserPayload) =>
  api<UserOut>("/users", { method: "POST", body: payload, auth: true });

export type AdminUpdateUserPayload = UpdateMePayload & {
  type?: "admin" | "client";
};

export const adminUpdateUser = (
  userId: string,
  payload: AdminUpdateUserPayload,
) => api<UserOut>(`/users/${userId}`, { method: "PUT", body: payload, auth: true });

export const deleteUser = (userId: string) =>
  api<{ detail: string }>(`/users/${userId}`, { method: "DELETE", auth: true });

// ---- public stats ----
export interface TopCitiesResponse {
  cities: Array<{ city: string; count: number }>;
}

export const getUsersCount = () =>
  api<{ total_users: number }>("/stats/count");

export const getAverageAge = () =>
  api<{ average_age: number | null }>("/stats/average-age");

export const getTopCities = () =>
  api<TopCitiesResponse>("/stats/top-cities");

// ---- avatar ----
export const uploadAvatar = async (file: File): Promise<UserOut> => {
  const token = localStorage.getItem(TOKEN_KEY);
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/users/me/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let detail = `Upload failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch { /* keep default */ }
    throw new Error(detail);
  }
  return response.json() as Promise<UserOut>;
};

export const removeAvatar = (): Promise<UserOut> =>
  api<UserOut>("/users/me/avatar", { method: "DELETE", auth: true });

export const avatarUrl = (avatar_url: string | null): string | null =>
  avatar_url ? `${BASE_URL}${avatar_url}` : null;
