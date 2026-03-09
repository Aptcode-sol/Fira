'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/api';
import { User } from '@/lib/types';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ user: User; token: string }>;
    register: (data: { email: string; password: string; name: string; role?: string }) => Promise<{ success: boolean; message: string; email: string }>;
    logout: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to normalize user object - ensures _id is always present
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeUser = (userData: any): User => {
    if (!userData) return userData;
    return {
        ...userData,
        _id: userData._id || userData.id, // Fallback to 'id' if '_id' is missing
    };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    // Load user from localStorage on mount (client-side only)
    useEffect(() => {
        setIsMounted(true);

        const storedToken = localStorage.getItem('fira_token');
        const storedUser = localStorage.getItem('fira_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(normalizeUser(parsedUser));
            } catch {
                localStorage.removeItem('fira_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const response = await authApi.login({ email, password });
        const userData = normalizeUser(response.user);
        const authToken = response.token;

        setUser(userData);
        setToken(authToken);
        localStorage.setItem('fira_token', authToken);
        localStorage.setItem('fira_user', JSON.stringify(userData));

        return { user: userData, token: authToken };
    }, []);

    const register = useCallback(async (data: { email: string; password: string; name: string; role?: string }) => {
        // Registration now returns a success message, not user data
        // User will be logged in after OTP verification
        const response = await authApi.register(data);
        return response; // Return the response for the component to handle
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('fira_token');
        localStorage.removeItem('fira_user');
    }, []);

    const updateUser = useCallback((updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem('fira_user', JSON.stringify(updatedUser));
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading: !isMounted || isLoading, // Still loading if not mounted OR localStorage not checked
                isAuthenticated: !!user && !!token,
                login,
                register,
                logout,
                updateUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
