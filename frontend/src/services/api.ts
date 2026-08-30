import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if not on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Email API
export const emailApi = {
  schedule: (data: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime: string;
    delayBetweenEmails: number;
    hourlyLimit: number;
  }) => apiClient.post('/api/emails/schedule', data),

  getScheduled: (page = 1, limit = 20) =>
    apiClient.get(`/api/emails/scheduled?page=${page}&limit=${limit}`),

  getSent: (page = 1, limit = 20) =>
    apiClient.get(`/api/emails/sent?page=${page}&limit=${limit}`),

  getById: (id: string) => apiClient.get(`/api/emails/${id}`),

  search: (params: { q?: string; status?: string; page?: number; limit?: number }) =>
    apiClient.get('/api/emails/search', { params }),

  cancel: (id: string) => apiClient.delete(`/api/emails/${id}`),

  uploadRecipients: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/emails/upload/recipients', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Sender API
export const senderApi = {
  list: () => apiClient.get('/api/senders'),
  create: (data: { name: string; email: string; isDefault?: boolean }) =>
    apiClient.post('/api/senders', data),
};

// Slack API
export const slackApi = {
  status: () => apiClient.get('/api/slack/status'),
  connect: () => apiClient.get('/api/slack/connect'),
  disconnect: () => apiClient.post('/api/slack/disconnect'),
};
