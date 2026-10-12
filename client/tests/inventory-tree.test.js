// The Inventories section's Visual tab : an inventory as a tree of groups and hosts, and what a
// file of the explorer is (an inventory, a group's or a host's vars).
import { describe, it, expect } from 'vitest';
import { inventoryOf, inventoryRows, inventoryFileRole } from '@/config/inventoryTree';

const inventory = `all:
  vars:
    ntp: pool.ntp.org
  children:
    web:
      hosts:
        web1.example.com:
          ansible_host: 10.0.0.1
        web2.example.com:
      vars:
        port: 80
        tls: true
    db:
      children:
        primary:
          hosts:
            db1.example.com:
`;

describe('inventoryOf', () => {
  it('reads the groups, their children and hosts, with their lines', () => {
    const inv = inventoryOf(inventory);
    expect(inv.kind).toBe('inventory');
    expect(inv.hosts).toBe(3);
    const [all] = inv.groups;
    expect(all).toMatchObject({ name: 'all', line: 1, vars: 1 });
    const [web, db] = all.children;
    expect(web).toMatchObject({ name: 'web', vars: 2 });
    expect(web.hosts).toEqual([
      { name: 'web1.example.com', line: 7, vars: 1 },
      { name: 'web2.example.com', line: 9, vars: 0 },
    ]);
    expect(db.children[0]).toMatchObject({ name: 'primary', hosts: [{ name: 'db1.example.com', vars: 0 }] });
  });

  it('lists the rows, a child group under its parent, hosts after the child groups', () => {
    const rows = inventoryRows(inventoryOf(inventory).groups);
    expect(rows.map((r) => `${r.depth}:${r.type}:${r.name}`)).toEqual([
      '0:group:all',
      '1:group:web',
      '2:host:web1.example.com',
      '2:host:web2.example.com',
      '1:group:db',
      '2:group:primary',
      '3:host:db1.example.com',
    ]);
  });

  it('tells a dynamic inventory, an empty one and a broken one', () => {
    expect(inventoryOf('plugin: community.vmware.vmware_vm_inventory\n')).toMatchObject({
      kind: 'plugin',
      plugin: 'community.vmware.vmware_vm_inventory',
    });
    expect(inventoryOf('').kind).toBe('empty');
    expect(inventoryOf('all: [\n').kind).toBe('invalid');
    expect(inventoryOf('- a\n').kind).toBe('invalid');
  });

  it('reads groups at the top, without all', () => {
    const inv = inventoryOf('web:\n  hosts:\n    w1:\n');
    expect(inv.groups.map((g) => g.name)).toEqual(['web']);
    expect(inv.hosts).toBe(1);
  });
});

describe('inventoryFileRole', () => {
  it('says what a file of an inventory is', () => {
    expect(inventoryFileRole('production/inventory.yaml')).toEqual({ inventory: 'production', role: 'inventory' });
    expect(inventoryFileRole('production/group_vars/web.yaml')).toEqual({
      inventory: 'production',
      role: 'group_vars',
      name: 'web',
    });
    expect(inventoryFileRole('production/host_vars/web1.yml')).toMatchObject({ role: 'host_vars', name: 'web1' });
    expect(inventoryFileRole('production/notes.md')).toEqual({ inventory: 'production', role: 'other' });
    expect(inventoryFileRole('readme.md')).toEqual({ inventory: '', role: 'other' });
  });

  it('with the repository first when there are several', () => {
    expect(inventoryFileRole('ops/production/inventory.yaml', true)).toEqual({
      inventory: 'ops/production',
      role: 'inventory',
    });
    expect(inventoryFileRole('ops/production', true).role).toBe('other');
  });
});
