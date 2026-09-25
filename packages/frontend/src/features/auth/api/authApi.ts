import { axiosClient } from '../../../shared/lib/axiosClient';
import { AuthResponse, LoginCredentials, SignupCredentials, User } from '../../../shared/types';

const USERS_STORAGE_KEY = 'knowhere_registered_users';

interface RegisteredUserRecord {
  name: string;
  role: 'student' | 'trainer' | 'admin';
  password?: string;
}

function getRegisteredUsers(): Record<string, RegisteredUserRecord> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(USERS_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegisteredUser(
  email: string,
  name: string,
  role: 'student' | 'trainer' | 'admin',
  password?: string
) {
  try {
    if (typeof window === 'undefined') return;
    const users = getRegisteredUsers();
    users[email.toLowerCase().trim()] = { name, role, password };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Ignore storage issues
  }
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const cleanEmail = credentials.email.toLowerCase().trim();

    try {
      const response = await axiosClient.post('/auth/login', credentials);
      const data = response.data?.data || response.data;
      const registered = getRegisteredUsers()[cleanEmail];
      const assignedRole: 'student' | 'trainer' | 'admin' = registered?.role || 'student';
      const assignedName = registered?.name || data.user?.name || credentials.email.split('@')[0];

      const user = data.user || {
        id: data.userId || `usr-${Date.now()}`,
        name: assignedName,
        email: credentials.email,
        roles: [assignedRole]
      };
      if (!user.roles || user.roles.length === 0) {
        user.roles = [assignedRole];
      }
      return {
        accessToken: data.accessToken,
        user
      };
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }

      // Local authentication check
      const registered = getRegisteredUsers()[cleanEmail];
      if (!registered) {
        throw new Error('No account found with this email. Please sign up first.');
      }
      if (registered.password && registered.password !== credentials.password) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      return {
        accessToken: `token-${Date.now()}`,
        user: {
          id: `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: registered.name,
          email: credentials.email,
          roles: [registered.role]
        }
      };
    }
  },

  signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
    const cleanEmail = credentials.email.toLowerCase().trim();
    const assignedRole: 'student' | 'trainer' | 'admin' = credentials.role || 'student';

    // Store in real user registry
    saveRegisteredUser(cleanEmail, credentials.name.trim(), assignedRole, credentials.password);

    try {
      const response = await axiosClient.post('/auth/signup', credentials);
      const data = response.data?.data || response.data;
      const user = data.user || {
        id: data.userId || `usr-${Date.now()}`,
        name: credentials.name.trim(),
        email: credentials.email,
        roles: [assignedRole]
      };
      if (!user.roles || user.roles.length === 0) {
        user.roles = [assignedRole];
      }
      return {
        accessToken: data.accessToken,
        user
      };
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }

      return {
        accessToken: `token-${Date.now()}`,
        user: {
          id: `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: credentials.name.trim(),
          email: credentials.email,
          roles: [assignedRole]
        }
      };
    }
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const response = await axiosClient.post('/auth/refresh');
    const data = response.data?.data || response.data;
    return {
      accessToken: data.accessToken
    };
  },

  logout: async (): Promise<void> => {
    await axiosClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await axiosClient.get('/auth/me');
    return response.data?.data || response.data;
  }
};
