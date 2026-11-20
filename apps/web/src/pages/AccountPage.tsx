import { LogOut, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeleteAccountDialog } from '@/features/auth/DeleteAccountDialog';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { CalendarCard } from '@/features/integrations/CalendarCard';
import { formatDate } from '@/lib/format';

export function AccountPage() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Set by the api when Google sends the user back: connected / denied / error / unavailable.
  const calendarResult = useSearchParams()[0].get('calendar');

  return (
    <>
      <PageHeader title="Account" description="Your profile, integrations and sign-in settings." />

      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold">Profile</h2>
          {/* Each label/value pair is grouped: stacked tightly on phones, side by side on wider
              screens, so a label always reads as belonging to its own value. */}
          <dl className="mt-4 space-y-4">
            {[
              { label: 'Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Member since', value: formatDate(user.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="sm:grid sm:grid-cols-[10rem_1fr] sm:items-baseline">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-0.5 font-semibold break-all sm:mt-0">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <CalendarCard result={calendarResult} />

        {/* The sidebar has a log-out button on desktop; on mobile this is where it lives. */}
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Session</h2>
            <p className="mt-1 text-sm text-muted">Log out of Debrief on this device.</p>
          </div>
          <Button
            variant="secondary"
            loading={logout.isPending}
            icon={<LogOut aria-hidden="true" className="size-4" />}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
          >
            Log out
          </Button>
        </Card>

        <Card className="border-danger/30 p-6">
          <h2 className="text-lg font-bold text-danger">Delete account</h2>
          <p className="mt-1 text-sm text-muted">
            Deactivates your account straight away and logs you out everywhere. You&apos;ll need
            {user.hasPassword ? ' your password' : ' to type your email'} to confirm.
          </p>
          <Button
            variant="danger"
            className="mt-5"
            icon={<Trash2 aria-hidden="true" className="size-4" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </Button>
        </Card>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/login', { replace: true })}
      />
    </>
  );
}
