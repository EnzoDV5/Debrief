// Tells the user clearly when the AI found nothing, so an empty result never looks like a bug.
// Finding nothing is a valid answer: Debrief never makes up tasks to fill the space.
// It sits under the Ask card, slides away once you add your own item, and can be dismissed.
import type { Meeting } from '@debrief/shared';
import { SearchCheck, TextSelect, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Collapsible } from '@/components/ui/Collapsible';
import { cn } from '@/lib/cn';

const LEAVE_MS = 350;

export function NoNotesFound({ meeting }: { meeting: Meeting }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  const noItems = meeting.actionItems.length === 0;
  const noDecisions = meeting.decisions.length === 0;
  const show = meeting.analysisStatus === 'done' && (noItems || noDecisions) && !dismissed;
  const nothing = noItems && noDecisions;

  // Stay mounted for a moment after it should go, so it can slide closed instead of vanishing.
  const [present, setPresent] = useState(show);
  if (show && !present) setPresent(true);
  useEffect(() => {
    if (show || !present) return;
    const timer = window.setTimeout(() => setPresent(false), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [show, present]);

  if (!present) return null;

  return (
    <Collapsible id={id} open={show}>
      <div
        className={cn(
          'transition-[opacity,scale] duration-300 ease-out-3',
          show ? 'scale-100 opacity-100 motion-safe:animate-loader-in' : 'scale-95 opacity-0',
        )}
      >
        {nothing ? (
          <div
            role="status"
            className="relative overflow-hidden rounded-card bg-surface text-fg shadow-raised ring-1 ring-line"
          >
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed(true)}
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-pill text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
            <div className="flex items-start gap-3 border-b border-line bg-spark/25 p-5 pr-12">
              <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-spark text-spark-fg shadow-card">
                <SearchCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-lg leading-tight font-bold">Nothing to action</p>
                <p className="mt-1 text-sm text-muted">
                  No action items or decisions were found in this meeting.
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {meeting.summary && (
                <div>
                  <p className="text-xs font-semibold tracking-label text-muted uppercase">
                    What was discussed
                  </p>
                  <p className="mt-1.5 leading-relaxed text-fg/90">{meeting.summary}</p>
                </div>
              )}
              <p className="text-muted">
                Debrief only lists tasks someone clearly took on, and never makes them up.
              </p>
              <p className="flex items-start gap-2 rounded-md bg-accent-soft p-3 text-fg">
                <TextSelect aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                Spotted one we missed? Select the words in the transcript to add it yourself.
              </p>
            </div>
          </div>
        ) : (
          <p
            role="status"
            className="inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-1.5 text-sm font-semibold text-muted shadow-card ring-1 ring-line"
          >
            <SearchCheck aria-hidden="true" className="size-4 text-accent" />
            {noItems ? 'No action items in this meeting' : 'No decisions in this meeting'}
          </p>
        )}
      </div>
    </Collapsible>
  );
}
