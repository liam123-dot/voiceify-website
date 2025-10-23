import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { updateAgentKeywords } from '@/lib/agent-keywords';

type RouteContext = {
  params: Promise<{ slug: string; id: string }>;
};

/**
 * POST /api/[slug]/agents/[id]/keywords
 * Update keywords for an agent's STT configuration
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { user, organizationId } = await getAuthSession(slug);

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { keywords } = body as { keywords: string[] };

    // Validate keywords
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'Keywords must be an array' },
        { status: 400 }
      );
    }

    // Validate each keyword is a non-empty string
    if (keywords.some((keyword) => typeof keyword !== 'string' || keyword.trim().length === 0)) {
      return NextResponse.json(
        { error: 'All keywords must be non-empty strings' },
        { status: 400 }
      );
    }

    // Update agent keywords
    const updatedConfiguration = await updateAgentKeywords(
      id,
      organizationId,
      keywords.map((k) => k.trim())
    );

    if (!updatedConfiguration) {
      return NextResponse.json(
        { error: 'Failed to update agent keywords' },
        { status: 500 }
      );
    }

    // Return updated keywords
    const updatedKeywords = updatedConfiguration.pipeline?.stt?.keywords || [];

    return NextResponse.json({ keywords: updatedKeywords });
  } catch (error) {
    console.error('Error in /api/[slug]/agents/[id]/keywords POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

