// Keeps an eye on analyses wherever you are in the app. When one finishes it shows a notification
// for 10 seconds and marks that meeting "new" in the sidebar until you open it. The analysis itself
// runs on the server, so moving around the site never interrupts it.
import type { AnalysisStatus, MeetingListItem } from '@debrief/shared';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { useMeetings } from './hooks';

const TOAST_MS = 10_000;
const LEAVE_MS = 220;
const STORAGE_KEY = 'debrief:new-results';

type Toast = { meetingId: string; title: string; ok: boolean };

const running = (status: AnalysisStatus) => status === 'pending' || status === 'processing';

// "New" marks survive a refresh. Storage can be blocked (private mode): then they last the visit.
function readFresh(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const FreshContext = createContext<ReadonlySet<string>>(new Set());

export function useFreshMeetings() {
  return useContext(FreshContext);
}

export function AnalysisWatchProvider({ children }: { children: ReactNode }) {
  const { data: meetings } = useMeetings();
  const { pathname } = useLocation();
  const [fresh, setFresh] = useState(readFresh);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [seen, setSeen] = useState<{
    list: MeetingListItem[] | undefined;
    status: Map<string, AnalysisStatus>;
  }>({ list: undefined, status: new Map() });

  // Compare each new list with the last one: anything that was running and now isn't just finished.
  if (meetings && meetings !== seen.list) {
    const finished = meetings.filter((meeting) => {
      const before = seen.status.get(meeting.id);
      return before !== undefined && running(before) && !running(meeting.analysisStatus);
    });
    setSeen({ list: meetings, status: new Map(meetings.map((m) => [m.id, m.analysisStatus])) });
    if (finished.length) {
      setToasts((current) => [
        ...current.filter((toast) => !finished.some((m) => m.id === toast.meetingId)),
        ...finished.map((m) => ({
          meetingId: m.id,
          title: m.title,
          ok: m.analysisStatus === 'done',
        })),
      ]);
      const done = finished.filter((m) => m.analysisStatus === 'done');
      if (done.length) setFresh((current) => new Set([...current, ...done.map((m) => m.id)]));
    }
  }

  // Opening a meeting means you've seen its results: it goes back to looking like the others.
  const openId = /^\/meetings\/([^/]+)$/.exec(pathname)?.[1];
  if (openId && fresh.has(openId)) {
    const next = new Set(fresh);
    next.delete(openId);
    setFresh(next);
  }

  const dismiss = useCallback(
    (meetingId: string) =>
      setToasts((current) => current.filter((toast) => toast.meetingId !== meetingId)),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...fresh]));
    } catch {
      // Storage blocked: the marks just won't survive a refresh.
    }
  }, [fresh]);

  return (
    <FreshContext.Provider value={fresh}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-[70] flex flex-col items-end gap-3 sm:right-6 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <AnalysisToast key={toast.meetingId} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </FreshContext.Provider>
  );
}

function AnalysisToast({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (meetingId: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDismiss(toast.meetingId), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss, toast.meetingId]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto relative w-[min(92vw,23rem)] overflow-hidden rounded-card border border-white/70 glass-float text-fg shadow-raised',
        leaving ? 'motion-safe:animate-toast-out' : 'motion-safe:animate-toast-in',
      )}
    >
      <div className="flex items-start gap-3 p-4 pr-12">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-pill',
            toast.ok ? 'bg-spark text-fg' : 'bg-danger-soft text-danger',
          )}
        >
          {toast.ok ? (
            <CircleCheck aria-hidden="true" className="size-5" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-bold">{toast.ok ? 'Analysis finished' : 'Analysis failed'}</p>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-semibold text-fg">“{toast.title}”</span>{' '}
            {toast.ok ? 'is ready to review.' : 'couldn’t be analysed. Your transcript is saved.'}
          </p>
          <Link
            to={`/meetings/${toast.meetingId}`}
            onClick={() => setLeaving(true)}
            className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {toast.ok ? 'Open meeting' : 'Open and retry'}
          </Link>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setLeaving(true)}
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-pill text-muted transition-colors hover:bg-fg/5 hover:text-fg"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 block h-1 origin-left motion-safe:animate-toast-timer',
          toast.ok ? 'bg-accent' : 'bg-danger',
        )}
      />
    </div>
  );
}
