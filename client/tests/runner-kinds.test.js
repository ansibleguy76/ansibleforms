// A runner's kind (what the dialog and its page offer) and its type and flavour (what is stored)
// map onto each other in config/settings.js. A kind that maps wrong saves silently as another
// type : a Semaphore or a Rundeck stored as an AWX would launch its templates on the default AWX.
import { describe, it, expect } from 'vitest';
import getSettings, { RUNNER_KINDS, runnerKind } from '@/config/settings';

const runners = getSettings((key) => key).runners;
const save = (item) => runners.beforeSave({ skip_verify: false, custom_ca: false, ...item });

describe('a runner kind and what is stored', () => {
  it('offers Semaphore, Rundeck and Jenkins next to the RTE and the awx flavours', () => {
    // the RTE first, the others alphabetically
    expect(RUNNER_KINDS).toEqual(['rte', 'aap', 'ascender', 'awx', 'jenkins', 'rundeck', 'semaphore']);
  });

  it('every kind is saved as a type that reads back as the same kind', () => {
    for (const kind of RUNNER_KINDS) {
      const stored = save({ kind, name: 'x', uri: 'https://x', project: 'p' });
      expect(runnerKind(stored)).toBe(kind);
    }
  });

  it('a Semaphore or a Rundeck keeps its project ; a Jenkins its folder', () => {
    expect(save({ kind: 'semaphore', project: ' 1 ' })).toMatchObject({
      type: 'semaphore',
      project: '1',
      flavour: null,
    });
    expect(save({ kind: 'rundeck', project: 'af' })).toMatchObject({ type: 'rundeck', project: 'af' });
    expect(save({ kind: 'jenkins', project: ' ops ' })).toMatchObject({
      type: 'jenkins',
      project: 'ops',
      flavour: null,
    });
  });

  it('the others store no project', () => {
    expect(save({ kind: 'aap', project: 'leftover' })).toMatchObject({ type: 'awx', flavour: 'aap', project: null });
    expect(save({ kind: 'rte', project: 'leftover' })).toMatchObject({ type: 'rte', project: null });
  });

  it('it signs in with a credential of its kind : an rte one for an RTE, an aap one for an AAP...', () => {
    const credential = runners.fields.find((f) => f.key === 'credential');
    const offered = (kind) =>
      ['api', 'userpass', 'rte', 'awx', 'aap', 'jenkins', 'semaphore'].filter((type) =>
        credential.choicesWhen({ name: 'c', credential_type: type }, { kind }),
      );
    expect(offered('rte')).toEqual(['rte']);
    expect(offered('semaphore')).toEqual(['semaphore']);
    expect(offered('jenkins')).toEqual(['jenkins']);
    expect(offered('aap')).toEqual(['aap']);
    expect(credential.createDefaults({ kind: 'jenkins' })).toEqual({ credential_type: 'jenkins' });
    expect(credential.createDefaults({ kind: 'ascender' })).toEqual({ credential_type: 'ascender' });
  });

  it('the defaults dialog has a group per runner type', () => {
    const { groupBy, groups } = runners.defaultPicker;
    expect(groups.map((g) => g.key)).toEqual(['rte', 'awx', 'semaphore', 'rundeck', 'jenkins']);
    for (const type of ['rte', 'awx', 'semaphore', 'rundeck', 'jenkins']) expect(groupBy({ type })).toBe(type);
  });
});
