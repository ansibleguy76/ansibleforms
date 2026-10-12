// The designer's toolbar : every section's buttons from one list - the same icon, title and place
// for the same action, whatever the order a section gives them in.
import { describe, it, expect } from 'vitest';
import { DESIGNER_ACTIONS, ACTION_ORDER, toolbarButtons } from '@/config/designerActions';

const t = (key) => `t:${key}`;

describe('the designer toolbar', () => {
  it('draws the actions in the standard order, with their icons and titles', () => {
    const run = () => {};
    const buttons = toolbarButtons(
      [
        { key: 'revert', run },
        { key: 'save', run, disabled: true },
        { key: 'newFile', run, title: 'New inventory' },
        { key: 'push', run, color: 'orange' },
      ],
      t,
    );
    expect(buttons.map((b) => b.key)).toEqual(['newFile', 'save', 'push', 'revert']);
    expect(buttons[0]).toMatchObject({ icon: 'file-circle-plus', title: 'New inventory' });
    expect(buttons[1]).toMatchObject({ icon: 'save', title: 't:designer.save', disabled: true });
    expect(buttons[2]).toMatchObject({ icon: 'code-branch', color: 'orange' });
  });

  it('leaves out what does not show, and refuses an action of its own', () => {
    expect(toolbarButtons([{ key: 'save', run: () => {}, show: false }], t)).toEqual([]);
    expect(() => toolbarButtons([{ key: 'mine', run: () => {} }], t)).toThrow(/Unknown designer action 'mine'/);
  });

  it('has one icon per action, but for the two pencils (edit a list, a form settings)', () => {
    const icons = ACTION_ORDER.map((k) => DESIGNER_ACTIONS[k].icon);
    const twice = icons.filter((i, n) => icons.indexOf(i) !== n);
    expect(twice).toEqual(['pencil']);
  });
});
