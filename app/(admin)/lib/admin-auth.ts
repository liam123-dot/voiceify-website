// app/(admin)/lib/admin-auth.ts
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

const ALLOWED_ADMIN_EMAILS = ['liam@buchananautomations.com'];

/**
 * Check if an email address belongs to an admin user
 * @param email - The email address to check
 * @returns true if the email is in the allowed admin list
 */
export function checkIsAdminEmail(email: string | null | undefined): boolean {
  return email ? ALLOWED_ADMIN_EMAILS.includes(email) : false;
}

export async function requireAdmin() {
  const { user } = await withAuth();

  // Check if user is authenticated
  if (!user?.email) {
    redirect('/signin');
  }

  // Check if user is in the allowed admins list
  if (!checkIsAdminEmail(user.email)) {
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
    return checkIsAdminEmail(user?.email);
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

    const isUserAdmin = checkIsAdminEmail(user.email);
    return { isAdmin: isUserAdmin, user };
  } catch {
    return { isAdmin: false, user: null };
  }
}

