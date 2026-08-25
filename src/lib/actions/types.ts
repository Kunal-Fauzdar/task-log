export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };
