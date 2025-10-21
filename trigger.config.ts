import { defineConfig } from "@trigger.dev/sdk/v3";
import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_fwfmjdpsogekaktxqpih",
  runtime: "node",
  logLevel: "log",
  machine: 'medium-2x',
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [syncVercelEnvVars({
      vercelAccessToken: process.env.VERCEL_ACCESS_TOKEN,
      projectId: process.env.VERCEL_PROJECT_ID,
      vercelTeamId: process.env.VERCEL_TEAM_ID
    })],
    external: [
      // WASM files
      "tiktoken_bg.wasm",
      
      // Frontend/React dependencies - NOT needed in background tasks
      "react",
      "react-dom",
      "next",
      "next-themes",
      
      // UI Component Libraries (Radix UI - 14 packages)
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "@radix-ui/themes",
      
      // Drag and Drop
      "@dnd-kit/core",
      "@dnd-kit/modifiers",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      
      // React Query/Table (frontend state management)
      "@tanstack/react-query",
      "@tanstack/react-table",
      
      // Form libraries
      "react-hook-form",
      "@hookform/resolvers",
      "react-day-picker",
      
      // Icon libraries
      "lucide-react",
      "@remixicon/react",
      "@tabler/icons-react",
      
      // CSS/Styling utilities
      "tailwind-merge",
      "tailwind-variants",
      "class-variance-authority",
      "clsx",
      
      // Chart/visualization libraries
      "recharts",
      "wavesurfer.js",
      
      // UI Components
      "sonner",
      "vaul",
      
      // Auth (handled in API routes, not background tasks)
      "@workos-inc/authkit-nextjs",
      "@workos-inc/node",
      "@workos-inc/widgets",
      
      // Services not used in this task
      "@elevenlabs/elevenlabs-js",
      "@livekit/protocol",
      "livekit-server-sdk",
      "@pipedream/sdk",
      "twilio",
      "ragie",
      "openai", // Using Voyage AI via fetch instead
      
      // Firecrawl SDK - now using direct API
      "@mendable/firecrawl-js",
      
      // Utilities not needed
      "date-fns",
      "@supabase/ssr", // Not needed - using @supabase/supabase-js directly
    ]
  },
  dirs: ["./src/trigger"],
});
