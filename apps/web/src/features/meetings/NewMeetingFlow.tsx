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
import { useState, type DragEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { applyApiError } from '@/lib/formErrors';
import { formatBytes, formatCalendarDate, plural, todayDate } from '@/lib/format';
import { useCreateMeeting } from './hooks';
import { readTranscriptFile, titleFromFilename } from './readTranscriptFile';
import { TranscriptView } from './TranscriptView';

type Draft =
  | { source: 'upload'; file: File; lines: TranscriptLine[]; suggestedTitle: string }
  | { source: 'paste'; text: string; lines: TranscriptLine[]; suggestedTitle: string };

export function NewMeetingFlow({ notice }: { notice?: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  return draft ? (
    <ReviewStep draft={draft} onBack={() => setDraft(null)} />
  ) : (
    <>
      {notice}
      <ChooseStep onReady={setDraft} />
    </>
  );
}

function ChooseStep({ onReady }: { onReady: (draft: Draft) => void }) {
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');

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
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col justify-center py-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">What would you like to debrief?</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Drop in a meeting transcript. You’ll check it before anything is analysed.
        </p>
      </div>

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
              or <span className="font-semibold text-accent underline">browse files</span> · .txt,
              .vtt or .md · up to 1 MB
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
              onClick={() => {
                setError(undefined);
                setPasting(true);
              }}
            >
              Paste text instead
            </Button>
          </div>
        </>
      ) : (
        <Card className="mt-8 p-5 sm:p-6">
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
                placeholder={'Thandi: Shall we ship on Friday?\nPieter: Yes, I’ll do the release.'}
                className="font-mono text-sm"
              />
            )}
          </Field>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              icon={<Upload aria-hidden="true" className="size-4" />}
              onClick={() => {
                setError(undefined);
                setPasting(false);
              }}
            >
              Upload a file instead
            </Button>
            <Button onClick={continueWithText} disabled={text.trim() === ''}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {error && !pasting && (
        <p id="choose-error" role="alert" className="mt-4 text-center font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewStep({ draft, onBack }: { draft: Draft; onBack: () => void }) {
  const navigate = useNavigate();
  const create = useCreateMeeting();
  const speakers = new Set(draft.lines.map((l) => l.speaker).filter(Boolean)).size;
  const detectedDate = detectMeetingDate(draft.lines);

  const {
    register,
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
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Choose a different transcript
      </button>
      <h1 className="text-2xl font-bold">Check your transcript</h1>
      <p className="mt-1 text-muted">
        This is how Debrief reads it. Nothing is analysed until you click Save & analyse.
      </p>

      {errors.root?.server && (
        <Alert tone="danger" className="mt-5">
          {errors.root.server.message}
        </Alert>
      )}

      <Card className="mt-6 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <Field label="Title" error={errors.title?.message}>
            {(control) => <Input {...control} {...register('title')} />}
          </Field>
          <Field
            label="Meeting date"
            hint={detectedDate ? 'Found in the transcript' : 'Today, by default'}
            error={errors.meetingDate?.message}
          >
            {(control) => <Input {...control} {...register('meetingDate')} type="date" />}
          </Field>
        </div>
      </Card>

      <section aria-label="Transcript preview" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <FileText aria-hidden="true" className="size-4 text-accent" />
            {draft.source === 'upload' ? draft.file.name : 'Pasted text'}
          </span>
          <span role="status" className="text-muted">
            {plural(draft.lines.length, 'line')} · {plural(speakers, 'speaker')}
            {draft.source === 'upload' && ` · ${formatBytes(draft.file.size)}`}
          </span>
        </div>
        {speakers === 0 && (
          <Alert tone="info" className="mb-3">
            No speakers were detected. That’s fine, but owners are easier to spot when lines look
            like “Name: what they said”.
          </Alert>
        )}
        <Card className="max-h-[60vh] overflow-y-auto p-3 sm:p-5">
          <TranscriptView lines={draft.lines} linkable={false} />
        </Card>
      </section>

      <div className="sticky bottom-3 z-20 mt-6 rounded-card border border-white/70 glass-float px-4 py-3 shadow-raised">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
            <Info aria-hidden="true" className="size-4" />
            Saving keeps the original text. The AI reads it next.
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="secondary"
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              Back
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              icon={<Sparkles aria-hidden="true" className="size-4" />}
              className="flex-1 sm:flex-none"
            >
              {isSubmitting ? 'Saving…' : 'Save & analyse'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
