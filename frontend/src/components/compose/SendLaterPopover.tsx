'use client';

import { useState } from 'react';
import { addMinutes, addHours, format, startOfTomorrow, setHours, setMinutes } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SendLaterPopoverProps {
  value: Date | null;
  onChange: (date: Date) => void;
  onCancel: () => void;
}

export function SendLaterPopover({ value, onChange, onCancel }: SendLaterPopoverProps) {
  const now = new Date();
  const [customDate, setCustomDate] = useState(
    value ? format(value, "yyyy-MM-dd'T'HH:mm") : ''
  );

  // Quick options (matching Figma design)
  const quickOptions = [
    {
      label: 'In 30 minutes',
      date: addMinutes(now, 30),
    },
    {
      label: 'In 1 hour',
      date: addHours(now, 1),
    },
    {
      label: 'Tomorrow 9:00 AM',
      date: setMinutes(setHours(startOfTomorrow(), 9), 0),
    },
    {
      label: 'Tomorrow 10:00 AM',
      date: setMinutes(setHours(startOfTomorrow(), 10), 0),
    },
    {
      label: 'Tomorrow 2:00 PM',
      date: setMinutes(setHours(startOfTomorrow(), 14), 0),
    },
  ];

  const handleCustomChange = (val: string) => {
    setCustomDate(val);
  };

  const handleDone = () => {
    if (customDate) {
      const date = new Date(customDate);
      if (!isNaN(date.getTime()) && date > new Date()) {
        onChange(date);
        return;
      }
    }
    onCancel();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Send Later</h3>
      </div>

      {/* Custom datetime picker */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1.5">Pick a date & time</label>
        <input
          type="datetime-local"
          value={customDate}
          min={format(addMinutes(now, 1), "yyyy-MM-dd'T'HH:mm")}
          onChange={(e) => handleCustomChange(e.target.value)}
          id="send-later-datetime"
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
        />
      </div>

      {/* Quick options */}
      <div className="space-y-1 mb-4">
        <p className="text-xs text-gray-400 mb-2">Quick options</p>
        {quickOptions.map(({ label, date }) => (
          <button
            key={label}
            onClick={() => {
              setCustomDate(format(date, "yyyy-MM-dd'T'HH:mm"));
            }}
            className={cn(
              'w-full text-left text-xs px-3 py-2 rounded-lg transition-colors',
              customDate === format(date, "yyyy-MM-dd'T'HH:mm")
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <span>{label}</span>
            <span className="text-gray-400 ml-2">
              {format(date, 'MMM d, h:mm a')}
            </span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onCancel}
          id="send-later-cancel"
          className="flex-1 text-xs py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDone}
          id="send-later-done"
          disabled={!customDate}
          className="flex-1 text-xs py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
