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

    // Get pagination and filter parameters from query string
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    const slug = searchParams.get('slug') // organization filter
    const agentId = searchParams.get('agent_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const supabase = await createServiceClient()

    // Build the base query with joins to organisations and agents
    let countQuery = supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })

    let dataQuery = supabase
      .from('calls')
      .select(`
        *,
        organisations!inner (
          slug
        ),
        agents (
          name
        )
      `)

    // Apply organization filter if slug is provided and not 'all'
    if (slug && slug !== 'all') {
      // Get organization ID from slug
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (orgError || !org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      countQuery = countQuery.eq('organization_id', org.id)
      dataQuery = dataQuery.eq('organization_id', org.id)
    }

    // Apply agent filter
    if (agentId && agentId !== 'all') {
      countQuery = countQuery.eq('agent_id', agentId)
      dataQuery = dataQuery.eq('agent_id', agentId)
    }

    // Apply date filters
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

    // Fetch calls with pagination
    const { data: calls, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching admin calls:', error)
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
    console.error('Error in GET /api/admin/calls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

