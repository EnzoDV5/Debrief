// The home screen: drop or paste a transcript, check it, then save and analyse.
import {
  detectMeetingDate,
  meetingDetailsSchema,
  parseTranscript,
  type MeetingDetailsInput,
  type TranscriptLine,
} from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ClipboardPaste, FileText, Info, Sparkles, Upload } from 'lucide-react';
import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { PageBar } from '@/components/layout/PageBar';
import { useShellPanelInset } from '@/components/layout/shellFrame';
import { Alert } from '@/components/ui/Alert';
import { AnimatedHeight } from '@/components/ui/AnimatedHeight';
import { Button } from '@/components/ui/Button';
import { DatePicker, meetingDateShortcuts } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { applyApiError } from '@/lib/formErrors';
import { formatBytes, formatCalendarDate, plural, todayDate } from '@/lib/format';
import { useSwap } from '@/lib/useSwap';
import { useCreateMeeting } from './hooks';
import { readTranscriptFile, titleFromFilename } from './readTranscriptFile';
import { barButtonClass } from './document/MeetingBarActions';
import { PANEL_INSET, PANEL_INSET_MARGIN } from './document/MeetingDocument';
import { TranscriptView } from './TranscriptView';

type Draft =
  | { source: 'upload'; file: File; lines: TranscriptLine[]; suggestedTitle: string }
  | { source: 'paste'; text: string; lines: TranscriptLine[]; suggestedTitle: string };

// Moving between the steps is a soft swap: the old step leaves, the new one rises in. The upload
// step uses the full frame and the check step the meeting page's narrower one; the frame starts
// sliding the moment you move on (`upcoming`), so it narrows while the upload step fades out.
export function NewMeetingFlow({ notice }: { notice?: ReactNode }) {
  const step = useSwap<Draft | null>(null);
  const draft = step.shown;
  const narrow = step.upcoming !== null;
  useShellPanelInset(
    narrow ? PANEL_INSET : FULL_FRAME,
    narrow ? 'transcript-edge-fade' : undefined,
  );
  return (
    <div key={draft ? 'check' : 'choose'} inert={step.leaving} className={step.animation}>
      {draft ? (
        <ReviewStep draft={draft} onBack={() => step.swapTo(null)} />
      ) : (
        <ChooseStep notice={notice} onReady={step.swapTo} narrowing={narrow} />
      )}
    </div>
  );
}

// The full-width frame for the upload step. Any value keeps the shell letting this page lay itself
// out (no shell padding), so nothing jumps when it switches to PANEL_INSET; the frame's right
// edge then slides (the shell animates it).
const FULL_FRAME = 'lg:right-0';

// The check step's two-column layout: content in the frame, a column beside it on wide
// screens (like the Ask column on the meeting page).
const flowColumns =
  'relative min-w-0 text-fg [--gap:1.5rem] [--notes:24rem] xl:grid xl:grid-cols-[minmax(0,1fr)_var(--notes)] xl:gap-x-(--gap) 2xl:[--notes:27rem]';
// The side column stays put while the frame scrolls.
const sideColumn = 'xl:sticky xl:top-0 xl:col-start-2 xl:row-start-1 xl:self-start xl:pr-4';

function ChooseStep({
  notice,
  onReady,
  narrowing,
}: {
  notice?: ReactNode;
  onReady: (draft: Draft) => void;
  // True while the frame narrows for the check step: the content glides left to stay centred in it.
  narrowing: boolean;
}) {
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('');

  // The drop box and the paste box swap in place (see useSwap).
  const box = useSwap<'drop' | 'paste'>('drop');
  const pasting = box.shown === 'paste';
  function swapTo(next: 'drop' | 'paste') {
    setError(undefined);
    box.swapTo(next);
  }

  async function chooseFile(file: File) {
    setError(undefined);
    setReading(true);
    const result = await readTranscriptFile(file);
    setReading(false);
    if (!result.ok) return setError(result.error);
    onReady({
      source: 'upload',
      file,
      lines: result.lines,
      suggestedTitle: titleFromFilename(file.name),
    });
  }

  function continueWithText() {
    const lines = parseTranscript(text, 'paste');
    if (lines.length === 0) return setError('Paste some transcript text first');
    onReady({
      source: 'paste',
      text,
      lines,
      suggestedTitle: `Meeting on ${formatCalendarDate(todayDate())}`,
    });
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void chooseFile(file);
  };

  return (
    <div
      className={cn(
        'text-fg transition-[margin] duration-500 ease-panel motion-reduce:transition-none',
        narrowing && PANEL_INSET_MARGIN,
      )}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-8">
        {notice}
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">What would you like to debrief?</h1>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Drop in a meeting transcript. You’ll check it before anything is analysed.
          </p>
        </div>

        {/* The height glides between the two boxes so the heading above moves smoothly too. The
          padding (cancelled by the negative margin) keeps card shadows from being clipped while
          it's moving. */}
        <AnimatedHeight className="-mx-3 -mb-3">
          <div className="px-3 pb-3">
            <div key={box.shown} inert={box.leaving} className={box.animation}>
              {!pasting ? (
                <>
                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      'mt-8 flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent',
                      dragging
                        ? 'border-accent bg-accent-soft'
                        : error
                          ? 'border-danger bg-danger-soft/40'
                          : 'border-line-strong/60 bg-surface hover:border-accent hover:bg-accent-soft/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-14 place-items-center rounded-pill bg-accent-soft text-accent"
                    >
                      <Upload className="size-7" />
                    </span>
                    <span className="text-lg font-bold">
                      {reading ? 'Reading your file…' : 'Drop a transcript here'}
                    </span>
                    <span className="text-sm text-muted">
                      or <span className="font-semibold text-accent underline">browse files</span> ·
                      .txt, .vtt or .md · up to 1 MB
                    </span>
                    <input
                      type="file"
                      accept=".txt,.vtt,.md,text/plain,text/vtt,text/markdown"
                      aria-label="Transcript file"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'choose-error' : undefined}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void chooseFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <div className="mt-5 text-center">
                    <Button
                      variant="ghost"
                      icon={<ClipboardPaste aria-hidden="true" className="size-4" />}
                      onClick={() => swapTo('paste')}
                    >
                      Paste text instead
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-8">
                  {/* No card around it: the paste box sits straight on the page, like the drop box. */}
                  <Field
                    label="Transcript text"
                    hint='Lines like "Name: text" are read as speakers. Up to 1 MB.'
                    error={error}
                  >
                    {(control) => (
                      <Textarea
                        {...control}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        rows={12}
                        autoFocus
                        spellCheck={false}
                        placeholder={
                          'Thandi: Shall we ship on Friday?\nPieter: Yes, I’ll do the release.'
                        }
                        className="font-mono text-sm"
                      />
                    )}
                  </Field>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button
                      variant="ghost"
                      icon={<Upload aria-hidden="true" className="size-4" />}
                      onClick={() => swapTo('drop')}
                    >
                      Upload a file instead
                    </Button>
                    <Button onClick={continueWithText} disabled={text.trim() === ''}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AnimatedHeight>

        {error && !pasting && (
          <p id="choose-error" role="alert" className="mt-4 text-center font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// Laid out like the meeting page: the heading and the meeting's details sit in the top bar, the
// transcript fills the frame, and the next step waits in the column beside it.
function ReviewStep({ draft, onBack }: { draft: Draft; onBack: () => void }) {
  const navigate = useNavigate();
  const create = useCreateMeeting();
  const speakers = new Set(draft.lines.map((l) => l.speaker).filter(Boolean)).size;
  const detectedDate = detectMeetingDate(draft.lines);
  // The top bar is drawn outside the <form> in the page, so its inputs join it by id (form=…).
  // That keeps Enter in the title field submitting the form.
  const formId = useId();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingDetailsInput>({
    resolver: zodResolver(meetingDetailsSchema),
    defaultValues: { title: draft.suggestedTitle, meetingDate: detectedDate ?? todayDate() },
  });

  const onSubmit = handleSubmit(async (details) => {
    try {
      const meeting = await create.mutateAsync(
        draft.source === 'upload'
          ? { ...details, source: 'upload', file: draft.file }
          : { ...details, source: 'paste', transcript: draft.text },
      );
      navigate(`/meetings/${meeting.id}`, { state: { created: true } });
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields : undefined;
      const transcriptProblem = fields?.file ?? fields?.transcript;
      if (transcriptProblem && !fields?.title && !fields?.meetingDate) {
        setError('root.server', { message: transcriptProblem });
        return;
      }
      applyApiError(error, setError, ['title', 'meetingDate']);
    }
  });

  return (
    <>
      <PageBar>
        <header className="flex animate-page-in flex-col gap-5 px-4 pt-7 sm:px-8 lg:flex-row lg:items-start lg:justify-between lg:px-1 lg:pt-0 lg:pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Choose a different transcript"
              title="Choose a different transcript"
              className={cn(barButtonClass(), 'size-9 shrink-0 justify-center px-0')}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold lg:text-xl lg:text-white">Check your transcript</h1>
              <p className="mt-1 text-sm text-muted lg:text-sidebar-muted">
                This is how Debrief reads it. Nothing is analysed until you click Save & analyse.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem] lg:w-[30rem] lg:shrink-0">
            <Field tone="bar" label="Title" error={errors.title?.message}>
              {(control) => (
                <Input {...control} {...register('title')} form={formId} className={barInput} />
              )}
            </Field>
            <Field
              tone="bar"
              label="Meeting date"
              hint={detectedDate ? 'Found in the transcript' : 'Today, by default'}
              error={errors.meetingDate?.message}
            >
              {(fieldProps) => (
                <Controller
                  name="meetingDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...fieldProps}
                      buttonRef={field.ref}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      shortcuts={meetingDateShortcuts()}
                      tone="bar"
                    />
                  )}
                />
              )}
            </Field>
          </div>
        </header>
      </PageBar>

      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className={cn(flowColumns, 'flex flex-col pb-10')}
      >
        {/* The frame: the whole transcript, drawn like the meeting page. */}
        <section aria-label="Transcript preview" className="xl:col-start-1 xl:row-start-1">
          <div className="px-4 pt-7 sm:px-8 lg:pt-9">
            <div className="border-b border-line pb-4">
              <h2 className="text-2xl font-bold">Transcript</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-accent" />
                  <span className="truncate">
                    {draft.source === 'upload' ? draft.file.name : 'Pasted text'}
                  </span>
                </span>
                <span role="status" className="text-muted">
                  {plural(draft.lines.length, 'line')} · {plural(speakers, 'speaker')}
                  {draft.source === 'upload' && ` · ${formatBytes(draft.file.size)}`}
                </span>
              </p>
            </div>
          </div>
          <TranscriptView lines={draft.lines} linkable={false} variant="document" />
        </section>

        {/* Right column on wide screens: the alerts and the Save card stay put together while the
            transcript scrolls. On small screens this wrapper steps aside (display: contents), so the
            alerts move above the transcript and the Save card sticks to the bottom of the screen. */}
        <div className={cn('contents xl:block xl:space-y-3', sideColumn)}>
          <div className="order-first space-y-3 px-4 pt-4 empty:hidden sm:px-8 xl:p-0">
            {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}
            {speakers === 0 && (
              <Alert tone="info">
                No speakers were detected. That’s fine, but owners are easier to spot when lines
                look like “Name: what they said”.
              </Alert>
            )}
          </div>
          <div className="sticky bottom-3 z-20 order-last mx-4 mt-6 rounded-card border border-white/70 glass-float px-4 py-3 shadow-raised sm:mx-8 xl:static xl:m-0">
            <p className="mb-3 hidden items-start gap-1.5 text-sm text-muted sm:flex">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Saving keeps the original text. The AI reads it next.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={onBack}
                disabled={isSubmitting}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                icon={<Sparkles aria-hidden="true" className="size-4" />}
                className="flex-1"
              >
                {isSubmitting ? 'Saving…' : 'Save & analyse'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

// Title and date inputs on the dark top bar (wide screens): translucent, light text, dark picker.
const barInput =
  'lg:border-sidebar-line lg:bg-sidebar-hover lg:text-white lg:placeholder:text-sidebar-muted lg:hover:border-white/50 lg:focus:border-white lg:aria-invalid:border-danger-light';
