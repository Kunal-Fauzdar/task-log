"use client";

import { useEffect, useState } from "react";

import { formatSecondsToDuration } from "@/lib/domain/duration";

// Ticks once a second while `startedAt` is set (a timer is actively running), showing
// baseSeconds + elapsed-since-startedAt. Renders a static value when `startedAt` is null.
export function LiveElapsed({
  baseSeconds,
  startedAt,
  className,
}: {
  baseSeconds: number;
  startedAt: Date | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsed = startedAt
    ? baseSeconds + Math.max(0, Math.round((now - startedAt.getTime()) / 1000))
    : baseSeconds;

  return <span className={className}>{formatSecondsToDuration(elapsed)}</span>;
}
