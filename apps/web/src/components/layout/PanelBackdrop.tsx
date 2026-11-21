// The softly moving colour blobs behind the page. GPU-friendly, and they stop if motion is reduced.
export function PanelBackdrop({ contained = false }: { contained?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={
        contained
          ? 'pointer-events-none absolute inset-0 overflow-hidden'
          : 'pointer-events-none fixed inset-0 overflow-hidden lg:absolute'
      }
    >
      <div className="absolute -top-48 -right-40 size-152 rounded-pill blob-lime will-change-transform motion-safe:animate-blob-1" />
      <div className="absolute -right-24 -bottom-64 size-176 rounded-pill blob-cobalt will-change-transform motion-safe:animate-blob-2" />
      <div className="absolute top-[18%] left-[8%] size-144 rounded-pill blob-cobalt-soft will-change-transform motion-safe:animate-blob-3" />
    </div>
  );
}
