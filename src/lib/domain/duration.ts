// Format: "H:MM:SS" — hours unpadded, minutes/seconds zero-padded to 2 digits (matches the
// submission format examples in CLAUDE.md §3, e.g. "4:00:00", "0:30:00").
const DURATION_PATTERN = /^(\d+):([0-5]\d):([0-5]\d)$/;

export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new RangeError(`Expected duration as "H:MM:SS", got "${value}"`);
  }
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function formatSecondsToDuration(totalSeconds: number): string {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 0) {
    throw new RangeError(`Expected a non-negative integer number of seconds, got ${totalSeconds}`);
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
