// A record page's search (lib/recordSearch.js, composables/useRecordSearch.js).
//
// A table's row matches by the cells its table shows (AppLinkedTable's), never by its raw values :
// an id or a flag no column shows must not keep a tab nobody can see the word in. The tabs shown
// are the open one, or while searching each tab with a match.
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { cellText, textsMatch, tableMatches } from '@/lib/recordSearch';
import { useRecordSearch } from '@/composables/useRecordSearch';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status', html: (r) => `<span class="badge">${r.status}</span>` },
  { key: 'when', label: 'When', value: (r) => `at ${r.when}` },
];
const rows = [{ id: 4711, name: 'Deploy', status: 'success', when: 'noon', secret: 'hidden' }];

describe('recordSearch', () => {
  it('reads a cell as its table shows it', () => {
    expect(cellText(columns[0], rows[0])).toBe('Deploy');
    expect(cellText(columns[1], rows[0])).toBe('success');
    expect(cellText(columns[2], rows[0])).toBe('at noon');
    expect(cellText({ key: 'missing' }, rows[0])).toBe('');
  });

  it('matches texts ignoring case, everything without a word', () => {
    expect(textsMatch('DEP', ['deploy'])).toBe(true);
    expect(textsMatch('', ['x'])).toBe(true);
    expect(textsMatch('  ', [])).toBe(true);
    expect(textsMatch('zzz', ['deploy', null, undefined])).toBe(false);
  });

  it('matches a table by its shown cells only', () => {
    expect(tableMatches('success', rows, columns)).toBe(true);
    expect(tableMatches('at noon', rows, columns)).toBe(true);
    // not shown by any column : the raw values do not count
    expect(tableMatches('4711', rows, columns)).toBe(false);
    expect(tableMatches('hidden', rows, columns)).toBe(false);
    // nor the markup
    expect(tableMatches('badge', rows, columns)).toBe(false);
  });
});

describe('useRecordSearch', () => {
  const tabs = ref([
    { key: 'details', label: 'Details' },
    { key: 'jobs', label: 'Jobs' },
  ]);
  const activeTab = ref('jobs');

  it('shows the open tab while nothing is searched, the matching ones after', () => {
    const s = useRecordSearch({
      tabs,
      activeTab,
      tabMatch: (key) => key === 'details' || s.tableMatches(rows, columns),
    });
    expect(s.shownTabs.value.map((x) => x.key)).toEqual(['jobs']);
    expect(s.searching.value).toBe(false);
    s.search.value = 'nothing like it';
    expect(s.searching.value).toBe(true);
    expect(s.shownTabs.value.map((x) => x.key)).toEqual(['details']);
    expect(s.tabShown('jobs')).toBe(false);
    s.search.value = 'deploy';
    expect(s.shownTabs.value.map((x) => x.key)).toEqual(['details', 'jobs']);
    expect(s.searchHead('details')).toEqual({ tab: tabs.value[0], first: true });
    expect(s.searchHead('jobs')).toEqual({ tab: tabs.value[1], first: false });
  });

  it('keeps the keys of the fields with the word', () => {
    const s = useRecordSearch({ search: ref('mail') });
    expect(
      s.matchingKeys([
        ['email', 'Email'],
        ['name', 'Name', 'help'],
        ['to', 'To', 'a mail address'],
      ]),
    ).toEqual(['email', 'to']);
    expect(s.matches('Mailbox')).toBe(true);
  });

  it('reads tabs and the open tab through getters', () => {
    const s = useRecordSearch({ tabs: () => tabs.value, activeTab: () => 'details' });
    expect(s.shownTabs.value.map((x) => x.key)).toEqual(['details']);
  });
});
