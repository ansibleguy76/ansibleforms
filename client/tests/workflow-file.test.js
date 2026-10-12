// A workflow file of the designer's Workflows section (config/workflowFile.js) : the AWX export
// syntax read (and the awx.awx collection's), what AWX would refuse found, its edits kept to the
// keys they touch, and a workflow laid out as AWX's visualizer does.
import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  workflowFileOf,
  workflowProblems,
  isWorkflowFile,
  workflowSkeleton,
  editAddJobTemplate,
  editJobTemplate,
  editAddNode,
  editNode,
  editLink,
  editUnlink,
  editRemoveNode,
  editWorkflow,
  workflowGraph,
} from '@/config/workflowFile';

// as `awx export` writes it
const EXPORT = `# deploys the app
job_templates:
  - name: Build app
    playbook: build.yaml
    inventory:
      name: production
    related:
      credentials:
        - name: ssh-prod
workflow_job_templates:
  - name: deploy-app
    description: Build, then deploy
    related:
      workflow_nodes:
        - identifier: build
          unified_job_template:
            name: Build app
            type: job_template
          related:
            success_nodes:
              - identifier: ok
            failure_nodes:
              - identifier: ask
        - identifier: ask
          unified_job_template:
            name: Go on anyway?
            type: workflow_approval_template
            timeout: 600
        - identifier: ok
          all_parents_must_converge: true
          unified_job_template:
            name: Build app
            type: job_template
`;

// as the awx.awx collection's workflow_job_template module takes it
const COLLECTION = `job_templates:
  - name: Hello
    playbook: hello.yaml
    inventory: staging
    credentials: [vault-prod]
workflow_job_templates:
  - name: hello
    workflow_nodes:
      - identifier: one
        unified_job_template: { name: Hello, type: job_template }
        related:
          always_nodes:
            - identifier: two
      - identifier: two
        unified_job_template: { name: Hello, type: job_template }
`;

const refs = {
  playbooks: ['build.yaml', 'hello.yaml'],
  inventories: ['production', 'staging'],
  credentials: ['ssh-prod', 'vault-prod'],
  repositories: ['app'],
};

describe('reading a workflow file', () => {
  it("reads the AWX export's shape", () => {
    const f = workflowFileOf(EXPORT);
    expect(f.kind).toBe('workflows');
    expect(f.jobTemplates[0]).toMatchObject({
      name: 'Build app',
      playbook: 'build.yaml',
      inventory: 'production',
      credentials: ['ssh-prod'],
    });
    const wf = f.workflows[0];
    expect(wf.name).toBe('deploy-app');
    expect(wf.nodes.map((n) => n.identifier)).toEqual(['build', 'ask', 'ok']);
    expect(wf.nodes[0]).toMatchObject({ type: 'job_template', success: ['ok'], failure: ['ask'], always: [] });
    expect(wf.nodes[1]).toMatchObject({ type: 'workflow_approval_template', timeout: '600' });
    expect(wf.nodes[2].converge).toBe(true);
    expect(workflowProblems(f, refs)).toEqual([]);
  });

  it("reads the awx.awx collection's shape", () => {
    const f = workflowFileOf(COLLECTION);
    expect(f.jobTemplates[0]).toMatchObject({ inventory: 'staging', credentials: ['vault-prod'] });
    expect(f.workflows[0].nodes[0].always).toEqual(['two']);
    expect(workflowProblems(f, refs)).toEqual([]);
  });

  it('tells a workflow file from another YAML file', () => {
    expect(isWorkflowFile(EXPORT)).toBe(true);
    expect(isWorkflowFile('foo: bar')).toBe(false);
    expect(workflowFileOf('').kind).toBe('empty');
    expect(workflowFileOf('a: [').kind).toBe('invalid');
  });
});

describe('what is wrong in it', () => {
  const keys = (text, r = refs) => workflowProblems(workflowFileOf(text), r).map((p) => p.key);

  it('finds what AWX would refuse', () => {
    const text = `job_templates: [{ name: A, playbook: build.yaml }]
workflow_job_templates:
  - name: w
    workflow_nodes:
      - identifier: x
        unified_job_template: { name: Missing, type: job_template }
        related: { success_nodes: [{ identifier: nowhere }] }
      - identifier: x
        unified_job_template: { name: src, type: inventory_source }
`;
    expect(keys(text)).toEqual(
      expect.arrayContaining(['nodeUnknownJt', 'nodeDuplicate', 'nodeBadType', 'linkUnknown']),
    );
  });

  it('finds a loop : a workflow is a DAG', () => {
    const text = `job_templates: [{ name: A, playbook: build.yaml }]
workflow_job_templates:
  - name: w
    workflow_nodes:
      - { identifier: a, unified_job_template: { name: A, type: job_template }, related: { success_nodes: [{ identifier: b }] } }
      - { identifier: b, unified_job_template: { name: A, type: job_template }, related: { always_nodes: [{ identifier: a }] } }
`;
    expect(keys(text)).toContain('loop');
  });

  it('names what the instance does not have, and nothing when it cannot tell', () => {
    const text = `job_templates: [{ name: A, playbook: gone.yaml, inventory: { name: nope }, related: { credentials: [{ name: nobody }] } }]`;
    expect(keys(text)).toEqual(['unknownPlaybook', 'unknownInventory', 'unknownCredential']);
    expect(keys(text, {})).toEqual([]);
  });
});

describe('its edits', () => {
  it('builds a workflow from a new file, as the export writes it', () => {
    let text = workflowSkeleton('deploy');
    const jt = editAddJobTemplate(text, 'Build');
    text = editJobTemplate(jt.text, 0, 'playbook', 'build.yaml');
    text = editJobTemplate(text, 0, 'inventory', 'production');
    text = editJobTemplate(text, 0, 'credentials', ['ssh-prod']);
    const a = editAddNode(text, 0, { identifier: 'build', type: 'job_template', name: 'Build' });
    const b = editAddNode(
      a.text,
      0,
      { identifier: 'notify', type: 'job_template', name: 'Build' },
      { identifier: 'build', kind: 'failure' },
    );
    const data = YAML.parse(b.text);
    expect(data.job_templates[0]).toEqual({
      name: 'Build',
      playbook: 'build.yaml',
      inventory: { name: 'production' },
      related: { credentials: [{ name: 'ssh-prod' }] },
    });
    const nodes = data.workflow_job_templates[0].related.workflow_nodes;
    expect(nodes[0].related.failure_nodes).toEqual([{ identifier: 'notify' }]);
    expect(workflowProblems(workflowFileOf(b.text), refs)).toEqual([]);
  });

  it('keeps comments and the rest as written', () => {
    const text = editNode(EXPORT, 0, 'build', 'converge', true);
    expect(text).toContain('# deploys the app');
    expect(text).toContain('description: Build, then deploy');
  });

  it('one link per pair : another kind replaces it ; unlinked, gone', () => {
    let text = editLink(EXPORT, 0, 'build', 'ok', 'always');
    let build = workflowFileOf(text).workflows[0].nodes[0];
    expect(build).toMatchObject({ success: [], always: ['ok'] });
    text = editUnlink(text, 0, 'build', 'ok');
    build = workflowFileOf(text).workflows[0].nodes[0];
    expect(build.always).toEqual([]);
  });

  it('a renamed node or job template : what points at it follows', () => {
    let text = editNode(EXPORT, 0, 'ok', 'identifier', 'done');
    expect(workflowFileOf(text).workflows[0].nodes[0].success).toEqual(['done']);
    text = editJobTemplate(text, 0, 'name', 'Compile app');
    expect(workflowFileOf(text).workflows[0].nodes.filter((n) => n.name === 'Compile app')).toHaveLength(2);
    text = editWorkflow(text, 0, 'description', 'x');
    expect(workflowProblems(workflowFileOf(text), refs)).toEqual([]);
  });

  it('a node removed takes its links with it', () => {
    const text = editRemoveNode(EXPORT, 0, 'ask');
    const f = workflowFileOf(text);
    expect(f.workflows[0].nodes.map((n) => n.identifier)).toEqual(['build', 'ok']);
    expect(f.workflows[0].nodes[0].failure).toEqual([]);
  });

  it('a new node gets a free identifier', () => {
    const { identifier } = editAddNode(EXPORT, 0, { identifier: 'build', type: 'job_template', name: 'Build app' });
    expect(identifier).toBe('build_2');
  });
});

describe('a workflow laid out', () => {
  it('a column per depth, the start linked to the nodes without a parent', () => {
    const g = workflowGraph(workflowFileOf(EXPORT).workflows[0].nodes);
    const x = Object.fromEntries(g.nodes.map((n) => [n.identifier, n.x]));
    expect(x.build).toBeLessThan(x.ok);
    expect(x.ask).toBe(x.ok);
    expect(g.links.filter((l) => l.kind === 'start').map((l) => l.to)).toEqual(['build']);
    expect(g.links.filter((l) => l.kind !== 'start')).toHaveLength(2);
  });
});
