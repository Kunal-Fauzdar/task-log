import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We maintain CLAUDE.md by hand as this project's architecture/decision log — don't let
  // `next dev` append its own auto-generated agent-rules block to it on every run.
  agentRules: false,
};

export default nextConfig;
