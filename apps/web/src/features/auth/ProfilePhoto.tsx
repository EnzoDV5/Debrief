// The big photo on the account page, with a camera button to upload your own and a link to remove it
// (which brings back your Google photo, if you have one).
import { AVATAR_SIZE } from '@debrief/shared';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { Spinner } from '@/components/ui/Spinner';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toSquareImage, UnreadableImageError } from '@/lib/squareImage';
import { useCurrentUser, useRemoveAvatar, useUploadAvatar } from './hooks';

function messageFor(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.fields?.file ?? error.message;
  if (error instanceof UnreadableImageError) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ProfilePhoto() {
  const user = useCurrentUser();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<unknown>(null);

  const busy = preparing || upload.isPending || remove.isPending;
  const error = messageFor(prepareError ?? upload.error ?? remove.error);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPrepareError(null);
    upload.reset();
    remove.reset();
    setPreparing(true);
    try {
      const photo = await toSquareImage(file, AVATAR_SIZE);
      upload.mutate(photo);
    } catch (err) {
      setPrepareError(err);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <UserAvatar
          src={user.avatarUrl}
          className="size-32 bg-sidebar-active text-sidebar-strong shadow-raised ring-8 ring-sidebar-strong/10"
          iconClassName="size-16"
          iconStrokeWidth={1.5}
        />
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-pill bg-sidebar/60 text-sidebar-strong">
            <Spinner label={remove.isPending ? 'Removing photo' : 'Uploading photo'} />
          </span>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          title={user.hasUploadedAvatar ? 'Change photo' : 'Upload a photo'}
          className="absolute right-0 bottom-0 grid size-10 place-items-center rounded-pill bg-accent text-accent-fg shadow-raised ring-4 ring-sidebar transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <Camera aria-hidden="true" className="size-5" />
          <span className="sr-only">
            {user.hasUploadedAvatar ? 'Change profile photo' : 'Upload a profile photo'}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>

      {user.hasUploadedAvatar && (
        <button
          type="button"
          onClick={() => {
            setPrepareError(null);
            upload.reset();
            remove.mutate();
          }}
          disabled={busy}
          className="mt-3 rounded-sm text-xs font-semibold text-sidebar-muted underline-offset-2 hover:text-sidebar-strong hover:underline disabled:opacity-60"
        >
          Remove photo
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-light">
          {error}
        </p>
      )}
    </div>
  );
}
