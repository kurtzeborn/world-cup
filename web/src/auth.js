// auth.js — SWA built-in auth helpers

/**
 * Fetch the current user from /.auth/me (SWA built-in endpoint).
 * Returns null if not authenticated.
 */
export async function fetchAuthUser() {
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    const cp = data?.clientPrincipal;
    if (!cp) return null;
    return {
      userId: cp.userId,
      displayName: cp.userDetails,
      identityProvider: cp.identityProvider,
      roles: cp.userRoles ?? [],
      isAdmin: (cp.userRoles ?? []).includes('admin'),
    };
  } catch {
    return null;
  }
}
