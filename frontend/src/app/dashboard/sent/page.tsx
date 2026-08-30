import { EmailListPage } from '@/components/email/EmailListPage';

export const metadata = {
  title: 'Sent Emails — ON8',
  description: 'View your sent email campaign history',
};

export default function SentPage() {
  return <EmailListPage type="sent" />;
}
