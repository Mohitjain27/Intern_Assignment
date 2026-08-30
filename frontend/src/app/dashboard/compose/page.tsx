'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailApi, senderApi } from '@/services/api';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Upload, X, Calendar, Clock, ChevronDown,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Undo, Redo, Type,
  Send,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { SendLaterPopover } from '@/components/compose/SendLaterPopover';
import { format, addMinutes } from 'date-fns';

interface RecipientChip {
  email: string;
  id: string;
}

export default function ComposePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form state
  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<RecipientChip[]>([]);
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showSendLater, setShowSendLater] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ validCount: number; invalidCount: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch senders
  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: senderApi.list,
  });
  const senders = sendersData?.data?.data?.senders || [];

  // Set default sender
  useEffect(() => {
    if (senders.length > 0 && !senderId) {
      setSenderId(senders.find((s: any) => s.isDefault)?.id || senders[0].id);
    }
  }, [senders, senderId]);


  // Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor px-4 py-3 focus:outline-none text-sm text-gray-800 leading-relaxed',
      },
    },
  });

  // Add recipient chip
  const addRecipient = useCallback((email: string) => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) return;
    if (recipients.some((r) => r.email === cleaned)) return;
    setRecipients((prev) => [...prev, { email: cleaned, id: Date.now().toString() }]);
  }, [recipients]);

  const handleRecipientKeyDown = (e: React.KeyboardEvent) => {
    if (['Enter', 'Tab', ',', ';'].includes(e.key)) {
      e.preventDefault();
      addRecipient(recipientInput);
      setRecipientInput('');
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // File upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await emailApi.uploadRecipients(file);
      const { valid, validCount, invalidCount } = res.data.data;
      setUploadStats({ validCount, invalidCount });
      setRecipients((prev) => {
        const existing = new Set(prev.map((r) => r.email));
        const newOnes = valid
          .filter((e: string) => !existing.has(e))
          .map((e: string) => ({ email: e, id: `${Date.now()}-${e}` }));
        return [...prev, ...newOnes];
      });
      toast.success(`Loaded ${validCount} valid email${validCount !== 1 ? 's' : ''}${invalidCount > 0 ? ` (${invalidCount} invalid)` : ''}`);
    } catch {
      toast.error('Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit
  const scheduleMutation = useMutation({
    mutationFn: (data: {
      senderId: string;
      subject: string;
      body: string;
      recipients: string[];
      startTime: string;
      delayBetweenEmails: number;
      hourlyLimit: number;
    }) => emailApi.schedule(data),
    onSuccess: (res) => {
      const { emailsScheduled } = res.data.data;
      toast.success(`✅ ${emailsScheduled} email${emailsScheduled !== 1 ? 's' : ''} scheduled!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      router.push('/dashboard/scheduled');
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.errors) {
        const errorMessages = Object.entries(data.errors)
          .map(([field, msgs]: any) => `${field}: ${msgs.join(', ')}`)
          .join('\n');
        toast.error(`Validation failed:\n${errorMessages}`);
      } else {
        toast.error(data?.message || 'Failed to schedule emails');
      }
    },
  });

  const handleSend = (sendNow = true) => {
    if (!senderId) return toast.error('Select a sender');
    if (!subject.trim()) return toast.error('Add a subject');
    if (recipients.length === 0) return toast.error('Add at least one recipient');
    const limit = hourlyLimit || 0;
    if (delayBetweenEmails < 0) return toast.error('Delay between emails must be 0 or greater');

    const body = editor?.getHTML() || '';
    if (!body || body === '<p></p>') return toast.error('Write your email body');

    const startTime = sendNow
      ? new Date(Date.now() + 2000).toISOString()
      : (scheduledTime || addMinutes(new Date(), 5)).toISOString();

    scheduleMutation.mutate({
      senderId,
      subject,
      body,
      recipients: recipients.map((r) => r.email),
      startTime,
      delayBetweenEmails: delayBetweenEmails * 1000, // convert to ms
      hourlyLimit: limit,
    });
  };

  const currentSender = senders.find((s: any) => s.id === senderId);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Compose New Email
        </button>

        <div className="flex-1" />

        {/* Icons */}
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
          <Clock className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
          <Upload className="w-4 h-4" />
        </button>

        {/* Action buttons */}
        <button
          onClick={() => router.back()}
          id="cancel-compose-btn"
          className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={() => handleSend(true)}
          disabled={scheduleMutation.isPending}
          id="send-now-btn"
          className="px-4 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          {scheduleMutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Email Form - Left */}
        <div className="flex-1 min-w-0 flex flex-col overflow-auto">
          <div className="p-5 space-y-0">
            {/* From */}
            <div className="flex items-center border-b border-gray-100 py-3 gap-3">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">From</span>
              <div className="relative flex-1">
                <select
                  id="sender-select"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="w-full text-sm text-gray-900 bg-transparent appearance-none focus:outline-none pr-6 cursor-pointer"
                >
                  {senders.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} &lt;{s.email}&gt;
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* To */}
            <div className="flex items-start border-b border-gray-100 py-3 gap-3">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0 mt-1.5">To</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {recipients.map((r) => (
                    <RecipientChip
                      key={r.id}
                      email={r.email}
                      onRemove={() => removeRecipient(r.id)}
                    />
                  ))}
                  <input
                    id="recipient-input"
                    type="text"
                    placeholder={recipients.length === 0 ? 'recipient@example.com' : ''}
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={handleRecipientKeyDown}
                    onBlur={() => {
                      if (recipientInput) {
                        addRecipient(recipientInput);
                        setRecipientInput('');
                      }
                    }}
                    className="text-sm text-gray-900 bg-transparent focus:outline-none flex-1 min-w-[120px] placeholder-gray-400"
                  />
                </div>
                {recipients.length > 0 && (
                  <p className="text-[10px] text-gray-400">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Upload List */}
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  id="upload-list-btn"
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 flex-shrink-0"
                  disabled={isUploading}
                >
                  {isUploading ? 'Loading...' : 'Upload List'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
                {uploadStats && (
                  <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                    {uploadStats.validCount} valid
                    {uploadStats.invalidCount > 0 && `, ${uploadStats.invalidCount} invalid`}
                  </p>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-gray-100 py-3 gap-3">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">Subject</span>
              <input
                id="subject-input"
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none placeholder-gray-400"
              />
            </div>

            {/* Delay + Hourly Limit */}
            <div className="flex items-center border-b border-gray-100 py-3 gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Delay between emails</span>
                <input
                  id="delay-input"
                  type="number"
                  min="0"
                  max="3600"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                  className="w-14 text-xs text-gray-900 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-400">s</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Hourly Limit</span>
                <input
                  id="hourly-limit-input"
                  type="number"
                  min="1"
                  max="10000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-16 text-xs text-gray-900 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Editor Toolbar */}
            {editor && <EditorToolbar editor={editor} />}

            {/* Editor */}
            <div className="min-h-[200px] bg-white">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Send Later Panel - Right */}
        {showSendLater && (
          <div className="w-[260px] flex-shrink-0 bg-white border-l border-gray-200 p-5">
            <SendLaterPopover
              value={scheduledTime}
              onChange={(date) => {
                setScheduledTime(date);
                setShowSendLater(false);
              }}
              onCancel={() => setShowSendLater(false)}
            />
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {scheduledTime ? (
            <>
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              <span className="text-primary-600 font-medium">
                Scheduled: {format(scheduledTime, 'MMM d, yyyy h:mm a')}
              </span>
              <button
                onClick={() => setScheduledTime(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <span className="text-gray-400">
              Will send immediately
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Send Later Button */}
          <button
            onClick={() => setShowSendLater(!showSendLater)}
            id="send-later-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Send Later
          </button>

          {/* Send Now */}
          <button
            onClick={() => handleSend(true)}
            disabled={scheduleMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {scheduledTime ? 'Schedule' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipientChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-medium">
      {email}
      <button
        onClick={onRemove}
        className="hover:text-primary-900 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function EditorToolbar({ editor }: { editor: any }) {
  const ToolbarBtn = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors',
        isActive && 'bg-gray-100 text-gray-900'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
        <Undo className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
        <Redo className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  );
}
