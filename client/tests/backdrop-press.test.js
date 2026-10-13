// A modal closed when a text selection started inside it and the mouse was released on the
// backdrop. It closes on a press that starts and ends on the backdrop only.
import { describe, it, expect } from 'vitest';
import { backdropPress } from '@/lib/backdropPress';

const backdrop = { id: 'backdrop' };
const field = { id: 'identifier' };
const on = (target) => ({ target });

describe('backdropPress', () => {
  const press = () => backdropPress((t) => t === backdrop);

  it('closes on a press that starts and ends on the backdrop', () => {
    const p = press();
    p.down(on(backdrop));
    expect(p.closes(on(backdrop))).toBe(true);
  });

  it('stays open when the press starts inside the modal and ends on the backdrop', () => {
    const p = press();
    p.down(on(field));
    expect(p.closes(on(backdrop))).toBe(false);
  });

  it('stays open on a press inside the modal', () => {
    const p = press();
    p.down(on(backdrop));
    expect(p.closes(on(field))).toBe(false);
  });

  it('forgets the press once it is clicked : a click without a press does not close', () => {
    const p = press();
    p.down(on(backdrop));
    p.closes(on(backdrop));
    expect(p.closes(on(backdrop))).toBe(false);
  });
});
