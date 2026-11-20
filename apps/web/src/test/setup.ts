// Adds DOM matchers like toBeInTheDocument() to Vitest's expect,
// and unmounts rendered components after each test.
import * as domMatchers from '@testing-library/jest-dom/matchers';
// Types only (erased at runtime): declares the matchers on Vitest's expect for TypeScript.
import type {} from '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';

// Extend the `expect` this file imports, the same one the tests get. jest-dom's own
// '@testing-library/jest-dom/vitest' entry imports `vitest` itself, and on Windows, when the
// shell's drive letter is lowercase (VS Code's `d:\`), that resolves to a second copy of vitest:
// the matchers then land on an `expect` no test uses, and every toBeInTheDocument() fails.
expect.extend(domMatchers);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom doesn't implement <dialog>.showModal()/close() yet (real browsers do). Minimal stand-in
// so components using the native dialog can be tested: toggles `open` and fires `close`.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
