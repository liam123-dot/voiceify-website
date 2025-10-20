import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback`,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      // Twilio webhook routes
      '/api/calls/incoming',
      '/api/calls/incoming/refer',
      '/api/calls/incoming/transfer-no-answer',
      '/api/calls/incoming/callback',
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

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /demo and /demo/* (demo pages)
     * - /api/calls/* (Twilio webhook routes)
     * - /api/callback (auth callback)
     * - /api/agents/* (agent routes)
     * - /api/phone-number/* (phone number routes)
     * - /api/tools/* (tool routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!demo|api/calls|api/callback|api/agents|api/phone-number|api/tools|_next/static|_next/image|favicon.ico).*)',
  ],
};