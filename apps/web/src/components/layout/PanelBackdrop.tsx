// Soft colour blobs drifting along the left and right edges, leaving the middle calm. Each one is blurred once and then only moved
// around (transform), so the GPU does the animation and the page stays smooth.
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
      <div className="absolute -top-32 -right-56 size-[30rem] blob bg-spark/35 motion-safe:animate-blob-1" />
      <div className="absolute -right-48 -bottom-56 size-[32rem] blob bg-accent/20 motion-safe:animate-blob-2" />
      <div className="absolute top-[15%] -left-60 size-[30rem] blob bg-violet/20 motion-safe:animate-blob-3" />
    </div>
  );
}
