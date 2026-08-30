'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { emailApi } from '@/services/api';
import { EmailRow, EmailRowSkeleton } from '@/components/email/EmailRow';
import { Search, RefreshCw, SlidersHorizontal, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EmailListPageProps {
  type: 'scheduled' | 'sent';
}

export function EmailListPage({ type }: EmailListPageProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['emails', type, page],
    queryFn: () =>
      type === 'scheduled'
        ? emailApi.getScheduled(page, limit)
        : emailApi.getSent(page, limit),
    refetchInterval: 10000,
  });

  const emails = data?.data?.data?.emails || [];
  const pagination = data?.data?.data?.pagination;

  const filteredEmails = search
    ? emails.filter(
        (e: { recipient: string; subject: string }) =>
          e.recipient.toLowerCase().includes(search.toLowerCase()) ||
          e.subject.toLowerCase().includes(search.toLowerCase())
      )
    : emails;

  const title = type === 'scheduled' ? 'Scheduled' : 'Sent';

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="email-search"
              placeholder={`Search ${title.toLowerCase()} emails...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className={cn(
              'p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors',
              isFetching && 'animate-spin text-primary-600 border-primary-200'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto bg-white mt-3 mx-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-200 rounded-t-xl">
          <div className="w-[200px] flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Recipient
          </div>
          <div className="w-[100px] flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Status
          </div>
          <div className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Subject
          </div>
          <div className="w-16 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">
            {type === 'scheduled' ? 'Scheduled' : 'Sent'}
          </div>
          <div className="w-5" />
        </div>

        {/* Email Rows */}
        {isLoading ? (
          <>
            {[...Array(8)].map((_, i) => (
              <EmailRowSkeleton key={i} />
            ))}
          </>
        ) : filteredEmails.length === 0 ? (
          <EmptyState type={type} hasSearch={!!search} />
        ) : (
          filteredEmails.map((email: { id: string }) => (
            <EmailRow key={email.id} email={email as any} />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} of{' '}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ type, hasSearch }: { type: string; hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Calendar className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        {hasSearch ? 'No results found' : `No ${type} emails`}
      </h3>
      <p className="text-xs text-gray-400 max-w-[200px]">
        {hasSearch
          ? 'Try adjusting your search query'
          : type === 'scheduled'
          ? 'Compose a campaign to schedule emails'
          : 'Sent emails will appear here'}
      </p>
    </div>
  );
}
