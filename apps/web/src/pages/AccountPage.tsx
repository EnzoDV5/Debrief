// The account page, laid out as a collage of blocks that fit together: profile, Google Calendar,
// the sidebar's Meetings list (clear it), appearance (dark/light), session (log out) and delete
// account.
import { isAnalysing } from '@debrief/shared';
import {
  Archive,
  CircleCheck,
  KeyRound,
  ListX,
  LogOut,
  Mail,
  Moon,
  Pencil,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { DeleteAccountDialog } from '@/features/auth/DeleteAccountDialog';
import { useCurrentUser, useLogout, useUpdateProfile } from '@/features/auth/hooks';
import { CalendarCard } from '@/features/integrations/CalendarCard';
import { useArchiveAllMeetings, useMeetings } from '@/features/meetings/hooks';
import { cn } from '@/lib/cn';
import { formatDate, plural } from '@/lib/format';
import { setTheme, useTheme, type Theme } from '@/lib/theme';

export function AccountPage() {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const calendarResult = useSearchParams()[0].get('calendar');

  return (
    <>
      <PageHeader title="Account" description="Your profile, integrations and settings." />

      <div className="grid gap-4 lg:grid-cols-12">
        <ProfileBlock />
        <div className="lg:col-span-8">
          <CalendarCard result={calendarResult} />
        </div>
        <MeetingsListBlock />
        <div className="grid gap-4 lg:col-span-3">
          <AppearanceBlock />
          <SessionBlock />
          <DeleteBlock onDelete={() => setDeleteOpen(true)} />
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/login', { replace: true })}
      />
    </>
  );
}

// Tall block on the left: a big profile picture with your name and email centred under it, and
// how you sign in. Click your name to change it right where it is.
function ProfileBlock() {
  const user = useCurrentUser();
  return (
    <section
      aria-labelledby="profile-heading"
      className="relative flex flex-col items-center overflow-hidden rounded-card bg-sidebar p-6 text-center text-sidebar-fg shadow-raised lg:col-span-4 lg:row-span-2"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-pill bg-accent/40 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-pill bg-spark/25 blur-3xl"
      />
      <h2 id="profile-heading" className="sr-only">
        Profile
      </h2>

      <div className="relative my-auto flex w-full flex-col items-center py-4">
        <span className="grid size-32 place-items-center rounded-pill bg-sidebar-active text-sidebar-strong shadow-raised ring-8 ring-sidebar-strong/10">
          <UserRound aria-hidden="true" className="size-16" strokeWidth={1.5} />
        </span>
        <EditableName name={user.name} />
        <p className="mt-1 flex max-w-full items-center justify-center gap-1.5 text-sm break-all text-sidebar-muted">
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          {user.email}
        </p>
      </div>

      <dl className="relative grid w-full grid-cols-2 gap-3 border-t border-sidebar-strong/10 pt-5 text-sm">
        <div>
          <dt className="text-xs font-semibold tracking-label text-sidebar-muted uppercase">
            Member since
          </dt>
          <dd className="mt-1 font-semibold text-sidebar-strong">{formatDate(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-label text-sidebar-muted uppercase">
            Signs in with
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-sidebar-strong">
            {user.hasPassword ? (
              <>
                <KeyRound aria-hidden="true" className="size-4" />
                Password
              </>
            ) : (
              <>
                <span className="grid size-5 place-items-center rounded-pill bg-white">
                  <GoogleLogo className="size-3.5" />
                </span>
                Google
              </>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Your name, editable in place: it looks like plain text with a pencil on hover; clicking turns it
// into a text box the same size. Enter or clicking away saves, Escape cancels.
function EditableName({ name }: { name: string }) {
  const update = useUpdateProfile();
  const [draft, setDraft] = useState<string | null>(null);
  const error =
    update.error instanceof ApiError
      ? (update.error.fields?.name ?? update.error.message)
      : update.error?.message;

  const save = () => {
    if (draft === null || update.isPending) return;
    if (draft.trim() === name) return setDraft(null);
    update.mutate({ name: draft }, { onSuccess: () => setDraft(null) });
  };
  const cancel = () => {
    update.reset();
    setDraft(null);
  };

  const text = 'mt-5 w-full text-2xl leading-tight font-bold text-sidebar-strong';
  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title="Click to change your name"
        className={cn(
          text,
          'group/name flex items-center justify-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-sidebar-strong/5',
        )}
      >
        <span className="break-words">{name}</span>
        <Pencil
          aria-hidden="true"
          className="size-4 shrink-0 text-sidebar-muted opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100"
        />
        <span className="sr-only">(change your name)</span>
      </button>
    );
  }
  return (
    <div className="relative w-full">
      <input
        aria-label="Your name"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'name-error' : undefined}
        autoFocus
        value={draft}
        maxLength={100}
        disabled={update.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') cancel();
        }}
        className={cn(
          text,
          'rounded-md bg-sidebar-strong/10 px-2 py-1 text-center ring-2 ring-accent/60 outline-none focus:ring-accent disabled:opacity-70 aria-invalid:ring-danger-light',
        )}
      />
      <p
        id="name-error"
        role={error ? 'alert' : undefined}
        className="absolute inset-x-0 top-full mt-1 text-sm text-danger-light"
      >
        {error ?? (update.isPending ? 'Saving…' : '')}
      </p>
    </div>
  );
}

// Clears the sidebar's Meetings list by moving those meetings to Archived (pinned ones stay).
// Two steps: the button asks first, then you confirm.
function MeetingsListBlock() {
  const { data: meetings = [] } = useMeetings();
  const archiveAll = useArchiveAllMeetings();
  const [confirming, setConfirming] = useState(false);
  // Same rule as the server: pinned meetings and ones still being analysed stay in the list.
  const inList = meetings.filter(
    (meeting) => !meeting.pinnedAt && !isAnalysing(meeting.analysisStatus),
  ).length;
  const pinned = meetings.filter((meeting) => meeting.pinnedAt).length;
  const analysing = meetings.filter(
    (meeting) => !meeting.pinnedAt && isAnalysing(meeting.analysisStatus),
  ).length;

  return (
    <Card className="flex flex-col p-6 lg:col-span-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-spark text-spark-fg"
        >
          <ListX className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Meetings list</h2>
          <p className="mt-1 text-sm text-muted">
            Clear the Meetings section in the sidebar. Meetings move to Archived, so nothing is lost
            and you can restore any of them.
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5" aria-live="polite">
        {archiveAll.isSuccess && !confirming ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CircleCheck aria-hidden="true" className="size-4" />
            {plural(archiveAll.data, 'meeting')} moved to Archived.
          </p>
        ) : confirming ? (
          <div className="rounded-md bg-surface-2 p-4 motion-safe:animate-step-in">
            <p className="text-sm font-semibold">
              Move {plural(inList, 'meeting')} to Archived?
              {pinned > 0 && (
                <span className="font-normal text-muted">
                  {' '}
                  {plural(pinned, 'pinned meeting')} will stay.
                </span>
              )}
              {analysing > 0 && (
                <span className="font-normal text-muted">
                  {' '}
                  {plural(analysing, 'meeting')} still being analysed will stay.
                </span>
              )}
            </p>
            {archiveAll.error && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {archiveAll.error.message}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={archiveAll.isPending}
                icon={<Archive aria-hidden="true" className="size-4" />}
                onClick={() =>
                  archiveAll.mutate(undefined, { onSuccess: () => setConfirming(false) })
                }
              >
                Yes, archive {plural(inList, 'meeting')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={archiveAll.isPending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {inList > 0
                ? `${plural(inList, 'meeting')} in your list`
                : analysing > 0
                  ? 'Wait for the analysis to finish before clearing the list.'
                  : 'Your Meetings list is already empty.'}
            </p>
            <Button
              variant="secondary"
              disabled={inList === 0}
              icon={<ListX aria-hidden="true" className="size-4" />}
              onClick={() => {
                archiveAll.reset();
                setConfirming(true);
              }}
            >
              Clear list
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Dark (the default) or light mode, remembered in this browser. Radio buttons styled as a
// segmented control, like the status buttons in the action item form.
function AppearanceBlock() {
  const theme = useTheme();
  const options: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
  ];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <fieldset>
        <legend className="font-bold">Appearance</legend>
        <p className="mt-0.5 text-sm text-muted">Remembered on this device.</p>
        <div className="relative mt-3 grid grid-cols-2 rounded-pill bg-surface-2 p-1">
          <span
            aria-hidden="true"
            style={{ transform: `translateX(${theme === 'light' ? 100 : 0}%)` }}
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-pill bg-surface shadow-card transition-transform duration-300 ease-out"
          />
          {options.map(({ value, label, icon: Icon }) => (
            <label key={value} className="relative cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="peer sr-only"
              />
              <span className="flex min-h-9 items-center justify-center gap-1.5 rounded-pill text-sm font-semibold text-muted transition-colors duration-200 peer-checked:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 hover:text-fg">
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

function SessionBlock() {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Card className="flex flex-col justify-between gap-3 p-5">
      <div>
        <h2 className="font-bold">Session</h2>
        <p className="mt-0.5 text-sm text-muted">Log out on this device.</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        loading={logout.isPending}
        icon={<LogOut aria-hidden="true" className="size-4" />}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
      >
        Log out
      </Button>
    </Card>
  );
}

function DeleteBlock({ onDelete }: { onDelete: () => void }) {
  return (
    <Card className="flex flex-col justify-between gap-3 border-danger/30 p-5">
      <div>
        <h2 className="font-bold text-danger">Delete account</h2>
        <p className="mt-0.5 text-sm text-muted">Logs you out everywhere. Asks you to confirm.</p>
      </div>
      <Button
        variant="danger"
        size="sm"
        className="self-start"
        icon={<Trash2 aria-hidden="true" className="size-4" />}
        onClick={onDelete}
      >
        Delete account
      </Button>
    </Card>
  );
}
