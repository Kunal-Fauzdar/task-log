"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

// Steps back through in-app history when there is any, otherwise lands on a sensible page
// (used on detail routes like /worklog/[date] that aren't reachable from the sidebar).
export function BackButton({
  fallbackHref = "/dashboard",
  label = "Back",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      // w-fit + self-start so it never stretches to fill a flex-column parent (which would
      // centre the label across the whole row); -ml-2 keeps the icon optically flush left.
      className="text-muted-foreground hover:text-foreground -ml-2 w-fit self-start"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Button>
  );
}
