'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { emailApi, slackApi } from '@/services/api';
import Link from 'next/link';
import {
  Calendar,
  Send,
  LogOut,
  ChevronDown,
  PenSquare,
  Slack,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Get email counts
  const { data: scheduledData } = useQuery({
    queryKey: ['emails', 'scheduled', 'count'],
    queryFn: () => emailApi.getScheduled(1, 1),
    refetchInterval: 15000,
  });

  const { data: sentData } = useQuery({
    queryKey: ['emails', 'sent', 'count'],
    queryFn: () => emailApi.getSent(1, 1),
    refetchInterval: 30000,
  });

  const { data: slackData } = useQuery({
    queryKey: ['slack', 'status'],
    queryFn: () => slackApi.status(),
  });

  const scheduledCount = scheduledData?.data?.data?.pagination?.total || 0;
  const sentCount = sentData?.data?.data?.pagination?.total || 0;
  const slackConnected = slackData?.data?.data?.connected || false;

  const navItems = [
    {
      href: '/dashboard/scheduled',
      label: 'Scheduled',
      icon: Calendar,
      count: scheduledCount,
    },
    {
      href: '/dashboard/sent',
      label: 'Sent',
      icon: Send,
      count: sentCount,
    },
  ];

  return (
    <div className="w-[240px] min-h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-mono">ON8</h1>
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="mx-3 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>

            {/* Name + Email */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Compose Button */}
      <div className="px-3 mb-4">
        <button
          onClick={() => router.push('/dashboard/compose')}
          id="compose-btn"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-primary-600 rounded-lg text-primary-600 text-sm font-medium hover:bg-primary-50 active:bg-primary-100 transition-colors duration-150"
        >
          <PenSquare className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-3 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">
          Core
        </p>

        <div className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, count }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');

            return (
              <Link
                key={href}
                href={href}
                id={`nav-${label.toLowerCase()}`}
                className={cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 group',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn(
                    'w-4 h-4',
                    isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
                  )} />
                  {label}
                </div>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-500'
                  )}>
                    {count > 999 ? '999+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Slack section */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">
            Integrations
          </p>
          <SlackItem connected={slackConnected} />
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          onClick={logout}
          id="logout-btn"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

function SlackItem({ connected }: { connected: boolean }) {
  const handleConnect = async () => {
    const { slackApi } = await import('@/services/api');
    const res = await slackApi.connect();
    window.open(res.data.data.url, '_blank', 'width=600,height=700');
  };

  return (
    <button
      onClick={handleConnect}
      id="slack-connect-btn"
      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors duration-150"
    >
      <div className="flex items-center gap-2.5">
        <Slack className="w-4 h-4 text-gray-400" />
        <span>Slack</span>
      </div>
      {connected ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <span className="text-[10px] text-primary-600 font-medium">Connect</span>
      )}
    </button>
  );
}
