import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params

    // Get pagination and filter parameters from query string
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    const agentId = searchParams.get('agent_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build the query with filters
    let countQuery = supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    let dataQuery = supabase
      .from('calls')
      .select('*, agents(name)')
      .eq('organization_id', organizationId)

    // Apply filters
    if (agentId) {
      countQuery = countQuery.eq('agent_id', agentId)
      dataQuery = dataQuery.eq('agent_id', agentId)
    }

    if (dateFrom) {
      countQuery = countQuery.gte('created_at', dateFrom)
      dataQuery = dataQuery.gte('created_at', dateFrom)
    }

    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      const dateToEnd = endDate.toISOString()
      countQuery = countQuery.lt('created_at', dateToEnd)
      dataQuery = dataQuery.lt('created_at', dateToEnd)
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting calls:', countError)
      return NextResponse.json({ error: 'Failed to count calls' }, { status: 500 })
    }

    // Fetch calls for the user's organization with pagination and filters
    const { data: calls, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching calls:', error)
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
    }

    return NextResponse.json({ 
      calls: calls || [], 
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/calls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

