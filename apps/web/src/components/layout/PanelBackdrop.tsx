/**
 * Slowly drifting colour blobs behind the page, in the brand lime and cobalt. Glass cards sit
 * on top and pick up their tint.
 *
 * Why this is cheap: each blob is a soft radial gradient (no blur filter), and the animation
 * only moves and scales it (transform), which the GPU handles without repainting the page.
 * Decorative only: hidden from screen readers, ignores the mouse, and stands still when the
 * user prefers reduced motion (rule in base.css).
 */
export function PanelBackdrop({ contained = false }: { contained?: boolean }) {
  return (
    <div
      aria-hidden="true"
      // Desktop: fills the framed panel. Mobile: fixed to the screen behind the scrolling page.
      // Contained: fills its parent at every size (the meeting page's own transcript sheet).
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
