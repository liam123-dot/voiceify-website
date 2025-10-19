import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

export async function GET() {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get organization details if organizationId exists
    let organization = null
    if (organizationId) {
      const supabase = await createClient()
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        console.error('Error fetching organization:', orgError)
      } else {
        organization = org
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      organization,
    })
  } catch (error) {
    console.error('Error in /api/user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
