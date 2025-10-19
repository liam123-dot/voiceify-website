import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      // Twilio webhook routes
      '/api/calls/incoming',
      '/api/calls/incoming/refer',
      '/api/calls/incoming/transfer-no-answer',
      '/api/callback',
      // Agent API routes (called by LiveKit agent)
      '/api/agents/:path*/calls',
      '/api/phone-number/:path*/agent',
      '/api/agents/:path*/retrieve',
      // Additional agent callback routes
      '/api/agents/callback',
      '/api/agents/:path*/tools',
      '/api/tools/:path*/execute',
      '/demo/:path*',
      '/demo'
    ],
  }
})
