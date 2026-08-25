import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

describe("PagePlaceholder", () => {
  it("renders the given title and phase", () => {
    render(<PagePlaceholder title="Dashboard" phase="Phase 5" />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Built in Phase 5.")).toBeInTheDocument();
  });
});
