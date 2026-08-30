import { cn } from '@/utils/cn';

type Status = 'SCHEDULED' | 'SENT' | 'FAILED' | 'PROCESSING' | 'RATE_LIMITED' | string;

interface BadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  SENT: {
    label: 'Sent',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  RATE_LIMITED: {
    label: 'Rate Limited',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
};

export function StatusBadge({ status, size = 'sm' }: BadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center border rounded-full font-medium',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
