'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import toast from 'react-hot-toast';
import { apiClient } from '@/services/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }

    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      toast.error('Authentication failed. Please try again.');
    }
  }, [isAuthenticated, isLoading, router, searchParams]);

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleDevLogin = async () => {
    try {
      const res = await apiClient.post('/api/auth/dev-login', {
        email: emailInput || undefined,
      });
      if (res.data.success) {
        toast.success('Logged in successfully!');
        router.push('/dashboard');
        // Small delay to ensure cookies are set before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch {
      toast.error('Dev login failed');
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-mono">ON8</h1>
            <p className="text-sm text-gray-500 mt-1">Email Campaign Scheduler</p>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">Login</h2>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            id="google-login-btn"
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-primary-600 rounded-lg text-primary-600 font-medium text-sm hover:bg-primary-50 transition-colors duration-150 mb-5"
          >
            <GoogleIcon />
            Login with Google
          </button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-white px-3">or sign in with email</span>
            </div>
          </div>

          {/* Email / Password (UI only — Google is the auth path) */}
          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleDevLogin}
            id="login-btn"
            className="w-full mt-5 px-4 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors duration-150"
          >
            Login
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by ON8 · Email Scheduler
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
