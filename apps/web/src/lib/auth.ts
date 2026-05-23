// Token and auth helpers
const TOKEN_KEY = 'vms_auth_token';
const USER_KEY = 'vms_user';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'SECURITY_GUARD' | 'RECEPTIONIST' | 'CONTRACTOR_SUPERVISOR' | 'EMPLOYEE';
  branchId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// Get token from localStorage
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Get user from localStorage
export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Set auth data after login
export function setAuth(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Clear auth data on logout
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Mock login (will be replaced with real API call in Phase 3)
export async function mockLogin(email: string, password: string): Promise<AuthResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock user data
  const mockUsers: Record<string, { password: string; user: AuthUser }> = {
    'admin@vms.com': {
      password: 'admin123',
      user: {
        id: '1',
        email: 'admin@vms.com',
        fullName: 'Admin User',
        role: 'SUPER_ADMIN',
        branchId: 'branch-1',
      },
    },
    'hr@vms.com': {
      password: 'hr123',
      user: {
        id: '2',
        email: 'hr@vms.com',
        fullName: 'HR Manager',
        role: 'HR_MANAGER',
        branchId: 'branch-1',
      },
    },
    'security@vms.com': {
      password: 'security123',
      user: {
        id: '3',
        email: 'security@vms.com',
        fullName: 'Security Guard',
        role: 'SECURITY_GUARD',
        branchId: 'branch-1',
      },
    },
  };

  const account = mockUsers[email];
  if (!account || account.password !== password) {
    throw new Error('Invalid email or password');
  }

  return {
    accessToken: `mock_token_${Date.now()}`,
    user: account.user,
  };
}

// Mock signup (will be replaced with real API call in Phase 3)
export async function mockSignup(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> {
  await new Promise(resolve => setTimeout(resolve, 500));

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  return {
    accessToken: `mock_token_${Date.now()}`,
    user: {
      id: `user_${Date.now()}`,
      email,
      fullName,
      role: 'EMPLOYEE',
      branchId: 'branch-1',
    },
  };
}
