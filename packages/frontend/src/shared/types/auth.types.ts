export interface User {
  id: string;
  email: string;
  name: string;
  roles: ('student' | 'trainer' | 'admin')[];
  avatar?: string;
  bio?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  role?: 'student' | 'trainer';
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
}
