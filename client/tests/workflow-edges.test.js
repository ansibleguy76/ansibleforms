import { describe, it, expect } from 'vitest';
import { workflowEdges, conditionText } from '../src/lib/workflowEdges.js';

describe('workflowEdges', () => {
  it('links on success, on failure and always, as AWX and AAP do', () => {
    const nodes = [
      { id: 1, success_nodes: [2], failure_nodes: [3], always_nodes: [4] },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ];
    expect(workflowEdges(nodes)).toEqual([
      { from: 1, to: 2, type: 'success' },
      { from: 1, to: 3, type: 'failure' },
      { from: 1, to: 4, type: 'always' },
    ]);
  });

  it("draws Ascender's conditional links, with their trigger and condition", () => {
    const nodes = [
      {
        id: 1,
        success_nodes: [],
        condition_edges: [
          { id: 2, trigger: 'failure', artifact_key: 'deploy', operator: 'ne', expected_value: 'true' },
          { id: 3, trigger: 'always', artifact_key: 'env', operator: 'eq', expected_value: '"prod"' },
        ],
      },
      { id: 2 },
      { id: 3 },
    ];
    expect(workflowEdges(nodes)).toEqual([
      {
        from: 1,
        to: 2,
        type: 'condition',
        trigger: 'failure',
        condition: { key: 'deploy', operator: 'ne', value: 'true' },
      },
      {
        from: 1,
        to: 3,
        type: 'condition',
        trigger: 'always',
        condition: { key: 'env', operator: 'eq', value: '"prod"' },
      },
    ]);
  });

  it('takes a link of unknown trigger on success, and keeps a condition it does not know as unknown', () => {
    const nodes = [{ id: 1, condition_edges: [{ id: 2, trigger: 'weird' }] }, { id: 2 }];
    expect(workflowEdges(nodes)).toEqual([{ from: 1, to: 2, type: 'condition', trigger: 'success', condition: null }]);
  });

  it('leaves out a link to a node not in the graph', () => {
    const nodes = [{ id: 1, success_nodes: [9], condition_edges: [{ id: 8, trigger: 'success' }] }];
    expect(workflowEdges(nodes)).toEqual([]);
    expect(workflowEdges(undefined)).toEqual([]);
  });
});

describe('conditionText', () => {
  it('reads as the condition', () => {
    expect(conditionText({ key: 'deploy', operator: 'eq', value: 'true' })).toBe('deploy = true');
    expect(conditionText({ key: 'env', operator: 'ne', value: '"prod"' })).toBe('env ≠ "prod"');
    expect(conditionText(null)).toBe('');
  });
});
