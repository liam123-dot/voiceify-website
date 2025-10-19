import { NextResponse } from 'next/server';
import { WorkOS } from '@workos-inc/node';
import { checkAdminAuth } from '@/app/(admin)/lib/admin-auth';

export async function GET() {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Initialize WorkOS client
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);

    // Fetch all organizations (remove the domains filter to get all)
    const organizations = await workos.organizations.listOrganizations();

    return NextResponse.json({
      organizations: organizations.data,
      success: true
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

