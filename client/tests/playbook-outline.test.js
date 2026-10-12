// A playbook's outline, the designer's Playbooks Visual tab (config/playbookOutline.js) : its
// plays and imports, their hosts and roles, their tasks by section, a block's under it, each task
// with its module and line.
import { describe, it, expect } from 'vitest';
import { playbookOutline, taskCount } from '@/config/playbookOutline';

const PLAYBOOK = `---
- import_playbook: common.yaml
- name: Deploy the app
  hosts: web
  become: true
  gather_facts: false
  roles:
    - nginx
    - role: app
  pre_tasks:
    - name: Wait for the host
      ansible.builtin.wait_for_connection:
  tasks:
    - name: Copy the release
      ansible.builtin.copy:
        src: app.tgz
        dest: /opt
      when: release is defined
    - block:
        - name: Restart
          service: name=app state=restarted
      rescue:
        - debug: msg=failed
    - include_tasks: extra.yaml
  handlers:
    - name: reload nginx
      service: name=nginx state=reloaded
`;

describe('a playbook outline', () => {
  const o = playbookOutline(PLAYBOOK);

  it('its plays and the playbooks it imports', () => {
    expect(o.kind).toBe('playbook');
    expect(o.plays[0]).toMatchObject({ kind: 'import', name: 'common.yaml', line: 2 });
    expect(o.plays[1]).toMatchObject({
      kind: 'play',
      name: 'Deploy the app',
      hosts: 'web',
      become: true,
      gather_facts: false,
    });
    expect(o.plays[1].roles.map((r) => r.name)).toEqual(['nginx', 'app']);
  });

  it('its tasks by section, each with its module and line, a block with its own', () => {
    const [pre, tasks, handlers] = o.plays[1].sections;
    expect(pre).toMatchObject({ key: 'pre_tasks' });
    expect(pre.tasks[0]).toMatchObject({ name: 'Wait for the host', module: 'ansible.builtin.wait_for_connection' });
    expect(tasks.tasks[0]).toMatchObject({ name: 'Copy the release', module: 'ansible.builtin.copy', line: 14 });
    expect(tasks.tasks[1].kind).toBe('block');
    expect(tasks.tasks[1].sections.map((s) => s.key)).toEqual(['block', 'rescue']);
    expect(tasks.tasks[1].sections[1].tasks[0]).toMatchObject({ module: 'debug', name: '' });
    expect(tasks.tasks[2]).toMatchObject({ module: 'include_tasks', include: 'extra.yaml' });
    expect(handlers.key).toBe('handlers');
    expect(taskCount(tasks.tasks)).toBe(4);
  });

  it('says what is not a playbook', () => {
    expect(playbookOutline('').kind).toBe('empty');
    expect(playbookOutline('a: b').kind).toBe('invalid');
    expect(playbookOutline('- [').kind).toBe('invalid');
  });
});
