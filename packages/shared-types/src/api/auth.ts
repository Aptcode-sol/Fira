import type { UserRole } from '../models/user';

// --- Requests ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  city?: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// --- Responses ---

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  isVerified: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
}

export interface RegisterResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
}

export interface LogoutResponse {
  message: string;
}
