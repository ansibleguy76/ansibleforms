// A backup has its own page (/settings/backups/<folder>, pages/admin/backup.vue), opened from
// the backups' list : its row and its menu's Open ; the menu has Download too. The list
// keeps its address, its tabs never taken for a backup : a backup's folder is the 14 digits of
// its timestamp.
import { describe, it, expect } from 'vitest';
import router from '@/router';
import getSettings from '@/config/settings';

const FOLDER = '20261019212310';
const backups = getSettings((key) => key).backups;

describe("a backup's page", () => {
  it('opens at /settings/backups/<folder>', () => {
    const r = router.resolve(`/settings/backups/${FOLDER}`);
    expect(r.name).toBe('/settings/backups/:folder');
    expect(r.params.folder).toBe(FOLDER);
    expect(r.meta.permission).toBe('allowBackupOps');
  });

  it('keeps its tab in the address, as every record page', () => {
    const r = router.resolve(`/settings/backups/${FOLDER}/details`);
    expect(r.name).toBe('/settings/backups/:folder');
    expect(r.params.tab).toBe('details');
  });

  it('leaves the list where it was : its address and its tabs', () => {
    expect(router.resolve('/settings/backups').name).toBe('/settings/backups');
    const tab = router.resolve('/settings/backups/list');
    expect(tab.name).toBe('/settings/backups');
    expect(tab.params.tab).toBe('list');
    // not 14 digits : not a backup
    expect(router.resolve('/settings/backups/2026').name).toBe('/settings/backups');
  });
});

describe("the backups' list", () => {
  it('opens a backup on its page from its row', () => {
    expect(backups.openPage({ folder: FOLDER })).toBe(`/settings/backups/${FOLDER}`);
  });

  it("has Open, Download, Restore and Delete in a row's menu, in that order", () => {
    expect(backups.actions.map((a) => a.name)).toEqual(['open', 'download', 'trigger', 'delete']);
    // a short label, as every row menu's ; the page is read only, so not Edit
    expect(backups.actions[0].title).toBe('common.open');
    // Restore apart from Open and Download (Delete gets its line on its own)
    expect(backups.actions.find((a) => a.name === 'trigger').dividerBefore).toBe(true);
    const [open, download] = backups.actions;
    expect(open.to({ folder: FOLDER })).toBe(`/settings/backups/${FOLDER}`);
    expect(download.icon).toBe('download');
    expect(download.title).toBe('settings.backups.download');
  });
});
