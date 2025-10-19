// app/(admin)/lib/admin-auth.ts
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

const ALLOWED_ADMIN_EMAILS = ['liam@buchananautomations.com'];

export async function requireAdmin() {
  const { user } = await withAuth();

  // Check if user is authenticated
  if (!user?.email) {
    redirect('/signin');
  }

  // Check if user is in the allowed admins list
  if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
    // Redirect to user's organization if not an admin
    const { slug } = await getAuthSession();
    if (slug) {
      redirect(`/${slug}`);
    } else {
      redirect('/signin');
    }
  }

  return { user };
}

export async function isAdmin(): Promise<boolean> {
  try {
    const { user } = await withAuth();
    return user?.email ? ALLOWED_ADMIN_EMAILS.includes(user.email) : false;
  } catch {
    return false;
  }
}

// For API routes - doesn't redirect, just returns auth status
export async function checkAdminAuth(): Promise<{ isAdmin: boolean; user: Awaited<ReturnType<typeof withAuth>>['user'] | null }> {
  try {
    const { user } = await withAuth();
    
    if (!user?.email) {
      return { isAdmin: false, user: null };
    }

    const isUserAdmin = ALLOWED_ADMIN_EMAILS.includes(user.email);
    return { isAdmin: isUserAdmin, user };
  } catch {
    return { isAdmin: false, user: null };
  }
}

