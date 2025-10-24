import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/app/(admin)/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth()
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createServiceClient()

    // Fetch all organizations from database with their slugs
    const { data: organizations, error } = await supabase
      .from('organisations')
      .select('id, external_id, slug')
      .order('slug', { ascending: true })

    if (error) {
      console.error('Error fetching organizations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organizations: organizations || [],
      success: true
    })
  } catch (error) {
    console.error('Error in /api/admin/organizations/slugs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

