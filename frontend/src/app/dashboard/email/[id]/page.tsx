'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailApi } from '@/services/api';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Mail, Send, AlertCircle, User, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/email/StatusBadge';
import { formatDateTime } from '@/utils/cn';
import toast from 'react-hot-toast';

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['email', id],
    queryFn: () => emailApi.getById(id),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => emailApi.cancel(id),
    onSuccess: () => {
      toast.success('Email cancelled');
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      router.push('/dashboard/scheduled');
    },
    onError: () => toast.error('Failed to cancel email'),
  });

  const email = data?.data?.data?.email;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500">Email not found</p>
        <button onClick={() => router.back()} className="text-xs text-primary-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            id="back-btn"
            className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
            {email.subject}
          </h1>
          <StatusBadge status={email.status} size="md" />
          {email.status === 'SCHEDULED' && (
            <button
              onClick={() => {
                if (confirm('Cancel this scheduled email?')) {
                  cancelMutation.mutate();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Email Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
          <div className="px-6 py-5">
            {/* Sender */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                {email.sender?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">
                    {email.sender?.name || 'Sender'}
                  </span>
                  <span className="text-xs text-gray-400">{email.sender?.email}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400">To:</span>
                  <span className="text-xs text-gray-600">{email.recipient}</span>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Scheduled</p>
                  <p className="text-xs text-gray-700 font-medium">
                    {formatDateTime(email.scheduledAt)}
                  </p>
                </div>
              </div>

              {email.sentAt && (
                <div className="flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-green-500" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sent</p>
                    <p className="text-xs text-gray-700 font-medium">
                      {formatDateTime(email.sentAt)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Attempts</p>
                  <p className="text-xs text-gray-700 font-medium">{email.attempts}</p>
                </div>
              </div>

              {email.providerMessageId && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Message ID</p>
                    <p className="text-xs text-gray-700 font-medium font-mono truncate max-w-[140px]">
                      {email.providerMessageId}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {email.errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600 font-medium">Error</p>
                <p className="text-xs text-red-500 mt-0.5">{email.errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Email Body */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{email.subject}</h2>
          </div>
          <div
            className="px-6 py-5 prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        </div>
      </div>
    </div>
  );
}
