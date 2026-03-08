import { HttpRequest } from '@azure/functions';

export interface AuthUser {
  userId: string;
  userDetails: string; // email or username
  identityProvider: string;
  userRoles: string[];
}

export function getAuthUser(request: HttpRequest): AuthUser | null {
  const clientPrincipal = request.headers.get('x-ms-client-principal');
  if (!clientPrincipal) return null;

  try {
    const decoded = Buffer.from(clientPrincipal, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    return {
      userId: principal.userId,
      userDetails: principal.userDetails,
      identityProvider: principal.identityProvider,
      userRoles: principal.userRoles || [],
    };
  } catch {
    return null;
  }
}

export function isAdmin(user: AuthUser): boolean {
  return user.userRoles.includes('admin');
}

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function requireAuth(request: HttpRequest): AuthUser {
  const user = getAuthUser(request);
  if (!user) throw new AuthError(401, 'Authentication required');
  return user;
}

export function requireAdmin(request: HttpRequest): AuthUser {
  const user = requireAuth(request);
  if (!isAdmin(user)) throw new AuthError(403, 'Admin role required');
  return user;
}
