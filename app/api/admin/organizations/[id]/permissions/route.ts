// app/api/admin/organizations/[id]/permissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { PermissionCategory } from '@/types/organisation';
import { checkAdminAuth } from '@/app/(admin)/lib/admin-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { permissions }: { permissions: PermissionCategory[] } = await request.json();

    // Validate permissions structure
    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Invalid permissions format' },
        { status: 400 }
      );
    }

    // Update the organization's permissions
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('organisations')
      .update({ permissions })
      .eq('external_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating permissions:', error);
      return NextResponse.json(
        { error: 'Failed to update permissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error in permissions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Fetch the organization's permissions
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('organisations')
      .select('permissions')
      .eq('external_id', id)
      .single();

    if (error) {
      console.error('Error fetching permissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch permissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      permissions: data.permissions,
    });
  } catch (error) {
    console.error('Error in permissions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

