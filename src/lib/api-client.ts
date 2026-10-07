import type {
  Build,
  CreateBuildInput,
  CreateGoalInput,
  CreateOkrInput,
  CreateReflectionInput,
  Goal,
  Milestone,
  Okr,
  Reflection,
  Snapshot,
  UpdateBuildInput,
  UpdateGoalInput,
  UpdateMilestoneInput,
  UpdateOkrInput,
  UpdateReflectionInput,
} from "@/lib/types";
import type { MoveDirection } from "@/lib/milestones";

/** Thrown for any non-2xx response; `message` is the server's `{ error }` string when present.
 *  `payload` is the parsed error body, for responses that carry more than a message. */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new ApiError("Network error — is the dev server running?", 0);
  }

  const text = await res.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

const enc = encodeURIComponent;

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export const api = {
  snapshot: () => request<Snapshot>("/api/snapshot"),

  createGoal: (input: CreateGoalInput) =>
    request<{ goal: Goal }>("/api/goals", json("POST", input)).then((r) => r.goal),
  updateGoal: (id: string, input: UpdateGoalInput) =>
    request<{ goal: Goal }>(`/api/goals/${enc(id)}`, json("PATCH", input)).then((r) => r.goal),
  deleteGoal: (id: string) =>
    request<{ ok: true; removedCheckIns: number }>(`/api/goals/${enc(id)}`, { method: "DELETE" }),

  setCheckIn: (goalId: string, date: string, done: boolean) =>
    request<{ ok: true }>("/api/check-ins", json("PUT", { goalId, date, done })),

  createOkr: (input: CreateOkrInput) => request<{ okr: Okr }>("/api/okrs", json("POST", input)).then((r) => r.okr),
  updateOkr: (id: string, input: UpdateOkrInput) =>
    request<{ okr: Okr }>(`/api/okrs/${enc(id)}`, json("PATCH", input)).then((r) => r.okr),
  deleteOkr: (id: string) => request<{ ok: true }>(`/api/okrs/${enc(id)}`, { method: "DELETE" }),

  addMilestone: (okrId: string, text: string) =>
    request<{ milestone: Milestone }>(`/api/okrs/${enc(okrId)}/milestones`, json("POST", { text })).then(
      (r) => r.milestone,
    ),
  updateMilestone: (id: string, input: UpdateMilestoneInput) =>
    request<{ milestone: Milestone }>(`/api/milestones/${enc(id)}`, json("PATCH", input)).then((r) => r.milestone),
  deleteMilestone: (id: string) => request<{ ok: true }>(`/api/milestones/${enc(id)}`, { method: "DELETE" }),
  moveMilestone: (id: string, direction: MoveDirection) =>
    request<{ ok: true }>(`/api/milestones/${enc(id)}/move`, json("POST", { direction })),

  listReflections: () => request<{ reflections: Reflection[] }>("/api/reflections").then((r) => r.reflections),
  createReflection: (input: CreateReflectionInput) =>
    request<{ reflection: Reflection }>("/api/reflections", json("POST", input)).then((r) => r.reflection),
  updateReflection: (id: string, input: UpdateReflectionInput) =>
    request<{ reflection: Reflection }>(`/api/reflections/${enc(id)}`, json("PATCH", input)).then(
      (r) => r.reflection,
    ),
  deleteReflection: (id: string) => request<{ ok: true }>(`/api/reflections/${enc(id)}`, { method: "DELETE" }),

  listBuilds: () => request<{ builds: Build[] }>("/api/builds").then((r) => r.builds),
  createBuild: (input: CreateBuildInput) =>
    request<{ build: Build }>("/api/builds", json("POST", input)).then((r) => r.build),
  updateBuild: (id: string, input: UpdateBuildInput) =>
    request<{ build: Build }>(`/api/builds/${enc(id)}`, json("PATCH", input)).then((r) => r.build),
  deleteBuild: (id: string) => request<{ ok: true }>(`/api/builds/${enc(id)}`, { method: "DELETE" }),
};
