export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001";
export const TOKEN_KEY = "usersys_token";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach the stored JWT (protected endpoints). */
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  /** Per-field messages extracted from FastAPI 422 responses. */
  fieldErrors: Record<string, string>;

  constructor(status: number, detail: string, fieldErrors: Record<string, string> = {}) {
    super(detail);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    let fieldErrors: Record<string, string> = {};
    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // FastAPI 422 validation array -> map to field names
        for (const issue of data.detail) {
          const loc = Array.isArray(issue.loc) ? issue.loc : [];
          const field = loc[loc.length - 1];
          if (typeof field === "string" && !(field in fieldErrors)) {
            fieldErrors[field] = issue.msg ?? "Invalid value";
          }
        }
      }
    } catch {
      /* non-JSON error body - keep defaults */
    }
    throw new ApiError(response.status, detail, fieldErrors);
  }

  return (await response.json()) as T;
}
