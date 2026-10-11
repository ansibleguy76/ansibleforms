// A runner's kind (what the dialog and its page offer) and its type and flavour (what is stored)
// map onto each other in config/settings.js. A kind that maps wrong saves silently as another
// type : a Semaphore or a Rundeck stored as an AWX would launch its templates on the default AWX.
import { describe, it, expect } from 'vitest';
import getSettings, { RUNNER_KINDS, runnerKind } from '@/config/settings';

const runners = getSettings((key) => key).runners;
const save = (item) => runners.beforeSave({ skip_verify: false, custom_ca: false, ...item });

describe('a runner kind and what is stored', () => {
  it('offers Semaphore and Rundeck next to the RTE and the awx flavours', () => {
    expect(RUNNER_KINDS).toEqual(['rte', 'awx', 'aap', 'ascender', 'semaphore', 'rundeck']);
  });

  it('every kind is saved as a type that reads back as the same kind', () => {
    for (const kind of RUNNER_KINDS) {
      const stored = save({ kind, name: 'x', uri: 'https://x', project: 'p' });
      expect(runnerKind(stored)).toBe(kind);
    }
  });

  it('a Semaphore or a Rundeck keeps its project and signs in with a token', () => {
    expect(save({ kind: 'semaphore', project: ' 1 ', use_credentials: true })).toMatchObject({
      type: 'semaphore',
      project: '1',
      use_credentials: false,
      flavour: null,
    });
    expect(save({ kind: 'rundeck', project: 'af' })).toMatchObject({ type: 'rundeck', project: 'af' });
  });

  it('the others store no project ; an awx runner keeps its choice of a user and password', () => {
    expect(save({ kind: 'aap', project: 'leftover', use_credentials: true })).toMatchObject({
      type: 'awx',
      flavour: 'aap',
      project: null,
      use_credentials: true,
    });
    expect(save({ kind: 'rte', project: 'leftover' })).toMatchObject({
      type: 'rte',
      project: null,
      use_credentials: false,
    });
  });

  it('a Semaphore or a Rundeck is no default in the defaults dialog', () => {
    const { groupBy } = runners.defaultPicker;
    expect(groupBy({ type: 'rte' })).toBe('playbook');
    expect(groupBy({ type: 'awx' })).toBe('template');
    expect(groupBy({ type: 'semaphore' })).toBe(null);
    expect(groupBy({ type: 'rundeck' })).toBe(null);
  });
});
