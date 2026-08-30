'use client';

import { StatusBadge } from '@/components/email/StatusBadge';
import { formatRelativeTime, truncate } from '@/utils/cn';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  sender?: { name: string; email: string };
}

interface EmailRowProps {
  email: Email;
}

export function EmailRow({ email }: EmailRowProps) {
  const [starred, setStarred] = useState(false);

  const timeStr = email.sentAt
    ? formatRelativeTime(email.sentAt)
    : email.scheduledAt
    ? formatRelativeTime(email.scheduledAt)
    : '';

  const bodyText = email.body
    ? email.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Link
      href={`/dashboard/email/${email.id}`}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors duration-100 border-b border-gray-100 last:border-b-0 group"
    >
      {/* To label + recipient */}
      <div className="w-[200px] flex-shrink-0">
        <p className="text-xs text-gray-400 mb-0.5">To:</p>
        <p className="text-sm font-medium text-gray-900 truncate">{email.recipient}</p>
      </div>

      {/* Status Badge */}
      <div className="w-[100px] flex-shrink-0">
        <StatusBadge status={email.status} />
      </div>

      {/* Subject + preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          <span className="font-medium">{email.subject}</span>
          {bodyText && (
            <span className="text-gray-400 font-normal ml-2">
              — {truncate(bodyText, 60)}
            </span>
          )}
        </p>
      </div>

      {/* Time */}
      <div className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">
        {timeStr}
      </div>

      {/* Star */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setStarred(!starred);
        }}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Star
          className={`w-3.5 h-3.5 ${
            starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      </button>
    </Link>
  );
}

export function EmailRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 animate-pulse">
      <div className="w-[200px] space-y-1.5">
        <div className="h-2.5 bg-gray-200 rounded w-8" />
        <div className="h-4 bg-gray-200 rounded w-32" />
      </div>
      <div className="w-[100px]">
        <div className="h-5 bg-gray-200 rounded-full w-20" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="w-16">
        <div className="h-3 bg-gray-200 rounded w-10 ml-auto" />
      </div>
      <div className="w-5 h-5 bg-gray-100 rounded" />
    </div>
  );
}
