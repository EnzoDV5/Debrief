// Where to put a floating list (dropdown, menu) as "fixed" coordinates. Normally fixed means "relative
// to the screen", but inside a pop-up with a blur or a transform the browser measures from the
// pop-up instead, so in that case we measure from the pop-up too.
export type Box = { left: number; top: number; right: number; bottom: number };

export function fixedFrame(container: Element): Box {
  if (container instanceof HTMLElement && container !== document.body) {
    const style = getComputedStyle(container);
    const backdrop =
      style.getPropertyValue('backdrop-filter') ||
      style.getPropertyValue('-webkit-backdrop-filter');
    const traps =
      style.transform !== 'none' ||
      style.filter !== 'none' ||
      (backdrop !== '' && backdrop !== 'none') ||
      style.perspective !== 'none' ||
      /paint|layout|strict|content/.test(style.contain) ||
      /transform|filter/.test(style.willChange);
    if (traps) {
      const rect = container.getBoundingClientRect();
      const left = rect.left + container.clientLeft;
      const top = rect.top + container.clientTop;
      return {
        left,
        top,
        right: left + container.clientWidth,
        bottom: top + container.clientHeight,
      };
    }
  }
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
}
