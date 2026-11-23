// The signed-in person's round avatar: their Google photo when there is one, otherwise a person icon.
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

export function UserAvatar({
  src,
  className,
  iconClassName,
  iconStrokeWidth,
}: {
  src: string | null;
  className?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
}) {
  // Remember which URL failed, so a new photo after the next sign-in gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && src !== failedSrc;

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-pill', className)}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          // Google's photo server can refuse requests that carry another site as the referrer.
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <UserRound className={iconClassName} strokeWidth={iconStrokeWidth} />
      )}
    </span>
  );
}
