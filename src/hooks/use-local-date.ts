import { useSyncExternalStore } from "react";

import { getLocalISODate, getLocalMonth } from "@/lib/domain/date";

// Same useSyncExternalStore pattern as useIsToday (src/hooks/use-is-today.ts) — "today"/"this
// month" are inherently client-only (the server doesn't know the user's timezone), so this
// avoids the effect+setState anti-pattern (react-hooks/set-state-in-effect) and the extra
// render it would cause. Returns null until mounted client-side, matching the server snapshot.
const noSubscription = () => () => {};

export function useLocalISODateValue(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => getLocalISODate(new Date()),
    () => null,
  );
}

export function useLocalMonthValue(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => getLocalMonth(new Date()),
    () => null,
  );
}
