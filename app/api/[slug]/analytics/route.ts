import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const { user, organizationId } = await getAuthSession(slug)
    console.log(organizationId)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = await createServiceClient()

    // Fetch all calls for analytics (we'll filter by time range on the client)
    // Only fetch necessary fields for analytics
    const { data: calls, error } = await supabase
      .from('calls')
      .select('id, created_at, duration_seconds, status')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching calls for analytics:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 })
    }

    return NextResponse.json({ calls: calls || [] })
  } catch (error) {
    console.error('Error in GET /api/[slug]/analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

