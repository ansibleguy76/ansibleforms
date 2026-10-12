// A workflow node's own keys, AnsibleForms' (config/workflowFile.js) : the runner a node runs a
// template or job on, its condition and the extravars key it gets - read, written as the file
// keeps them, checked against the instance's runners, and a skipped node in the dry run.
import { describe, it, expect } from 'vitest';
import { workflowFileOf, workflowProblems, editNode, onTemplateRunner, nextStep } from '@/config/workflowFile';

const FILE = `workflow_job_templates:
  - name: mixed
    workflow_nodes:
      - identifier: provision
        unified_job_template: { name: Create VM, type: job_template }
        runner: aap-prod
        inventory: vmware
        related: { success_nodes: [{ identifier: configure }] }
      - identifier: configure
        unified_job_template: { name: configure.yaml, type: job_template }
        if_extra_var: configure
        extra_vars_key: vm
        related: { success_nodes: [{ identifier: notify }] }
      - identifier: notify
        unified_job_template: { name: notify.yaml, type: job_template }
`;
const runners = [
  { name: 'aap-prod', type: 'awx' },
  { name: 'rte-vmware', type: 'rte' },
];

describe("a node's own keys", () => {
  const wf = workflowFileOf(FILE).workflows[0];
  const node = (id) => wf.nodes.find((n) => n.identifier === id);

  it('are read', () => {
    expect(node('provision').runner).toBe('aap-prod');
    expect(node('configure').if_extra_var).toBe('configure');
    expect(node('configure').extra_vars_key).toBe('vm');
    expect(node('notify').runner).toBe('');
  });

  it('are written on the node, and an emptied one is removed', () => {
    let text = editNode(FILE, 0, 'notify', 'runner', 'rte-vmware');
    expect(workflowFileOf(text).workflows[0].nodes[2].runner).toBe('rte-vmware');
    text = editNode(text, 0, 'configure', 'if_extra_var', '');
    expect(text).not.toMatch(/if_extra_var/);
  });

  it('a node on a template runner is no designer playbook ; one on an RTE or none is', () => {
    expect(onTemplateRunner(node('provision'), { runners })).toBe(true);
    expect(onTemplateRunner({ ...node('notify'), runner: 'rte-vmware' }, { runners })).toBe(false);
    expect(onTemplateRunner(node('notify'), { runners })).toBe(false);
  });
});

describe('what is wrong in it', () => {
  it('a runner node is not checked against the playbooks and inventories ; an unknown runner is named', () => {
    const file = workflowFileOf(FILE);
    const problems = workflowProblems(file, { runners, playbooks: ['configure.yaml', 'notify.yaml'], inventories: [] });
    expect(problems.map((p) => p.key)).toEqual([]);
    const other = workflowProblems(file, {
      runners: [{ name: 'rte-vmware', type: 'rte' }],
      playbooks: ['configure.yaml', 'notify.yaml'],
    });
    expect(other.map((p) => p.key)).toEqual(['nodeUnknownRunner']);
  });
});

describe('a skipped node in the dry run', () => {
  it('lets what follows it on success run', () => {
    const wf = workflowFileOf(FILE).workflows[0];
    const state = new Map(wf.nodes.map((n) => [n.identifier, { status: 'pending', doNotRun: false }]));
    state.get('provision').status = 'successful';
    state.get('configure').status = 'skipped';
    expect(nextStep(wf.nodes, state).start).toEqual(['notify']);
  });
});
