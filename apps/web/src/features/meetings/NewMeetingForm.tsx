import {
  createMeetingFromTextSchema,
  meetingDetailsSchema,
  parseTranscript,
  utf8ByteLength,
  type TranscriptLine,
} from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardPaste, Upload } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { applyApiError } from '@/lib/formErrors';
import { formatBytes, todayDate } from '@/lib/format';
import { FileDropzone } from './FileDropzone';
import { useCreateMeeting } from './hooks';
import { readTranscriptFile, titleFromFilename } from './readTranscriptFile';
import { TranscriptPreview, transcriptSummary } from './TranscriptPreview';

// The shared schemas, plus which input the transcript comes from. Pasting requires text;
// uploading ignores the textarea (the file is checked separately, it isn't a form value).
const formSchema = z.discriminatedUnion('source', [
  createMeetingFromTextSchema.extend({ source: z.literal('paste') }),
  meetingDetailsSchema.extend({ source: z.literal('upload'), transcript: z.string() }),
]);

type ChosenFile = { file: File; lines: TranscriptLine[] };

export function NewMeetingForm() {
  const navigate = useNavigate();
  const createMeeting = useCreateMeeting();
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [fileError, setFileError] = useState<string>();

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: 'paste' as 'paste' | 'upload',
      title: '',
      meetingDate: todayDate(),
      transcript: '',
    },
    mode: 'onTouched',
  });

  // useWatch (not watch()) re-renders only this component when these fields change, and works
  // with the React Compiler's automatic memoisation.
  const source = useWatch({ control, name: 'source' });
  const transcript = useWatch({ control, name: 'transcript' });

  // Parse for the preview with a deferred copy of the text: typing stays instant even for a
  // huge paste, and the preview catches up a moment later.
  const deferredTranscript = useDeferredValue(transcript);
  const pastedLines = useMemo(
    () => parseTranscript(deferredTranscript, 'paste'),
    [deferredTranscript],
  );
  const previewLines = source === 'paste' ? pastedLines : (chosen?.lines ?? []);

  async function chooseFile(file: File) {
    setFileError(undefined);
    const result = await readTranscriptFile(file);
    if (!result.ok) {
      setChosen(null);
      setFileError(result.error);
      return;
    }
    setChosen({ file, lines: result.lines });
    // A sensible title from the file name, unless the user already typed one.
    if (!getValues('title').trim()) {
      setValue('title', titleFromFilename(file.name), { shouldValidate: true });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (values.source === 'upload' && !chosen) {
      setFileError('Choose a transcript file to upload');
      return;
    }
    try {
      const meeting = await createMeeting.mutateAsync(
        values.source === 'upload' && chosen
          ? { ...values, source: 'upload', file: chosen.file }
          : { ...values, source: 'paste' },
      );
      navigate(`/meetings/${meeting.id}`, { state: { created: true } });
    } catch (error) {
      // File problems found by the server go under the file picker.
      const fields = error instanceof ApiError ? error.fields : undefined;
      const fileMessage =
        fields?.file ?? (values.source === 'upload' ? fields?.transcript : undefined);
      if (fileMessage) {
        setFileError(fileMessage);
        if (!fields?.title && !fields?.meetingDate) return;
      }
      applyApiError(error, setError, ['title', 'meetingDate', 'transcript']);
    }
  });

  const pastedBytes = utf8ByteLength(transcript);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold">Meeting details</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <Field label="Title" error={errors.title?.message}>
            {(control) => (
              <Input {...control} {...register('title')} placeholder="e.g. Weekly product sync" />
            )}
          </Field>
          <Field label="Meeting date" error={errors.meetingDate?.message}>
            {(control) => <Input {...control} {...register('meetingDate')} type="date" />}
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Transcript</h2>
          <SegmentedControl
            name="source"
            legend="How do you want to add the transcript?"
            value={source}
            onChange={(next) => setValue('source', next, { shouldValidate: false })}
            options={[
              {
                value: 'paste',
                label: 'Paste text',
                icon: <ClipboardPaste aria-hidden="true" className="size-4" />,
              },
              {
                value: 'upload',
                label: 'Upload a file',
                icon: <Upload aria-hidden="true" className="size-4" />,
              },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            {source === 'paste' ? (
              <Field
                label="Transcript text"
                hint={
                  pastedBytes > 0
                    ? `${formatBytes(pastedBytes)} of 1 MB. Lines like "Name: text" are read as speakers.`
                    : 'Lines like "Name: text" are read as speakers. Up to 1 MB.'
                }
                error={errors.transcript?.message}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    {...register('transcript')}
                    rows={14}
                    spellCheck={false}
                    placeholder={
                      'Thandi: Shall we ship on Friday?\nPieter: Yes, I’ll do the release.'
                    }
                    className="font-mono text-sm"
                  />
                )}
              </Field>
            ) : (
              <Field label="Transcript file" error={fileError}>
                {(control) => (
                  <FileDropzone
                    control={control}
                    file={chosen?.file ?? null}
                    summary={chosen ? transcriptSummary(chosen.lines) : undefined}
                    onFile={(file) => void chooseFile(file)}
                    onClear={() => setChosen(null)}
                  />
                )}
              </Field>
            )}
          </div>
          <TranscriptPreview lines={previewLines} />
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button to="/meetings" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save meeting'}
        </Button>
      </div>
    </form>
  );
}
