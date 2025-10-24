import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/app/(admin)/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth()
    
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Get optional slug parameter for filtering
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    const supabase = await createServiceClient()

    let query = supabase
      .from('calls')
      .select(`
        id,
        created_at,
        duration_seconds,
        status,
        organization_id,
        organisations!inner (
          id,
          slug,
          external_id
        )
      `)
      .order('created_at', { ascending: false })

    // If slug is provided, filter by that organization
    if (slug) {
      // First, get the organization ID from the slug
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (orgError || !org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      query = query.eq('organization_id', org.id)
    }

    const { data: calls, error } = await query

    if (error) {
      console.error('Error fetching calls for admin analytics:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 })
    }

    // Transform the data to include organization slug at the top level for easier grouping
    const transformedCalls = calls?.map(call => {
      // Supabase may return organisations as an object or array depending on the join type
      const orgs = call.organisations as unknown
      const org = (Array.isArray(orgs) ? orgs[0] : orgs) as { id: string; slug: string; external_id: string }
      return {
        id: call.id,
        created_at: call.created_at,
        duration_seconds: call.duration_seconds,
        status: call.status,
        organization_id: call.organization_id,
        organization_slug: org.slug,
      }
    }) || []

    return NextResponse.json({ calls: transformedCalls })
  } catch (error) {
    console.error('Error in GET /api/admin/analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

