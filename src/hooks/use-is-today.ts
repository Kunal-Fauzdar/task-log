import { useSyncExternalStore } from "react";

import { getLocalISODate } from "@/lib/domain/date";

// Whether `dateParam` is the browser's current local date. Uses useSyncExternalStore (not
// useEffect+useState) so React can reconcile the server/client snapshot mismatch correctly in
// one pass — "today" is inherently client-only (the server doesn't know the user's timezone),
// and effect+setState for this causes an extra cascading render (flagged by
// react-hooks/set-state-in-effect).
const noSubscription = () => () => {};

export function useIsToday(dateParam: string): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => dateParam === getLocalISODate(new Date()),
    () => false,
  );
}
