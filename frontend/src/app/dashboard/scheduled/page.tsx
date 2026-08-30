import { EmailListPage } from '@/components/email/EmailListPage';

export const metadata = {
  title: 'Scheduled Emails — ON8',
  description: 'View and manage your scheduled email campaigns',
};

export default function ScheduledPage() {
  return <EmailListPage type="scheduled" />;
}
