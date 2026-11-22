import { describe, expect, it } from 'vitest';
import { centerOffset } from './centerRow';

// The free space between the Ask card (bottom at 300px) and the panel's bottom edge (900px).
// Its middle is at 600px.
const space = { top: 300, bottom: 900 };

describe('centerOffset', () => {
  it('scrolls down when the row sits below the middle', () => {
    // A 100px row centred at 850px needs to move up the screen by 250px.
    expect(centerOffset({ top: 800, bottom: 900 }, space)).toBe(250);
  });

  it('scrolls up when the row sits above the middle', () => {
    expect(centerOffset({ top: 100, bottom: 200 }, space)).toBe(-450);
  });

  it('does nothing when the row is already centred', () => {
    expect(centerOffset({ top: 550, bottom: 650 }, space)).toBe(0);
  });

  it('lines the top up with the Ask card when the row is too tall to fit', () => {
    expect(centerOffset({ top: 500, bottom: 1300 }, space)).toBe(200);
  });
});
