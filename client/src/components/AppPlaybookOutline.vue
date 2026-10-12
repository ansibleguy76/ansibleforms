<script setup>
/******************************************************************/
/*                                                                */
/*  A playbook's Preview : its outline - its plays (and the playbooks it   */
/*  imports), each with its hosts, its roles and its tasks by     */
/*  section, a block's under it ; each task with its module. A    */
/*  play, a section or a block folds ; a name opens the YAML on   */
/*  its line. Read only : the playbook is edited in the YAML.     */
/*                                                                */
/*  @props:                                                       */
/*      modelValue: String - the playbook's YAML                  */
/*  @emits:                                                       */
/*      reveal: the line to open the YAML on                      */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { playbookOutline, taskCount } from '@/config/playbookOutline';

const props = defineProps({
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['reveal']);
const { t } = useI18n();

const outline = computed(() => playbookOutline(props.modelValue));

/**
 * The outline as rows, each a level deeper than what holds it : a play, its roles and its
 * sections, their tasks, a block's sections and tasks.
 *
 * Returns:
 *   object[]: { id, depth, type : 'play' | 'import' | 'roles' | 'role' | 'section' | 'block' |
 *     'task', name, line, count (what it holds), ...the item }.
 */
const rows = computed(() => {
  const out = [];
  if (outline.value.kind !== 'playbook') return out;
  const tasks = (list, depth, parent) => {
    list.forEach((task, i) => {
      const id = `${parent}/${i}`;
      if (task.kind === 'block') {
        out.push({ ...task, type: 'block', id, depth, count: task.sections.length });
        for (const s of task.sections) {
          out.push({
            type: 'section',
            key: s.key,
            id: `${id}/${s.key}`,
            depth: depth + 1,
            count: s.tasks.length,
            line: task.line,
          });
          tasks(s.tasks, depth + 2, `${id}/${s.key}`);
        }
      } else {
        out.push({ ...task, type: 'task', id, depth });
      }
    });
  };
  outline.value.plays.forEach((play, p) => {
    const id = `p${p}`;
    if (play.kind === 'import') {
      out.push({ ...play, type: 'import', id, depth: 0 });
      return;
    }
    const count = play.sections.reduce((n, s) => n + taskCount(s.tasks), 0);
    out.push({ ...play, type: 'play', id, depth: 0, count: count + play.roles.length, tasks: count });
    if (play.roles.length) {
      out.push({
        type: 'section',
        key: 'roles',
        id: `${id}/roles`,
        depth: 1,
        count: play.roles.length,
        line: play.roles[0].line,
      });
      play.roles.forEach((r, i) => out.push({ ...r, type: 'role', id: `${id}/roles/${i}`, depth: 2 }));
    }
    for (const s of play.sections) {
      out.push({
        type: 'section',
        key: s.key,
        id: `${id}/${s.key}`,
        depth: 1,
        count: s.tasks.length,
        line: s.tasks[0]?.line ?? play.line,
      });
      tasks(s.tasks, 2, `${id}/${s.key}`);
    }
  });
  return out;
});

// what is folded : a row's id ; the rows under it hidden
const folded = ref(new Set());
const shown = computed(() => rows.value.filter((r) => ![...folded.value].some((f) => r.id.startsWith(`${f}/`))));
/**
 * Folds or unfolds a row.
 *
 * Args:
 *   id (string): the row.
 */
function toggle(id) {
  const next = new Set(folded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  folded.value = next;
}
const foldable = (row) => ['play', 'section', 'block'].includes(row.type) && row.count > 0;

// its counts, over the outline
const playCount = computed(() => (outline.value.plays || []).filter((p) => p.kind === 'play').length);
const allTasks = computed(() => rows.value.filter((r) => r.type === 'task').length);

// each row's icon
const ICONS = { play: 'play', import: 'file-import', role: 'cubes', block: 'layer-group', task: 'list-check' };
const SECTION_ICONS = {
  roles: 'cubes',
  pre_tasks: 'list-ol',
  tasks: 'list-ol',
  post_tasks: 'list-ol',
  handlers: 'bell',
  block: 'layer-group',
  rescue: 'life-ring',
  always: 'rotate',
};
</script>
<template>
  <div>
    <div v-if="outline.kind === 'invalid'" class="alert alert-warning d-flex align-items-center gap-2">
      <FaIcon icon="triangle-exclamation" />
      <span class="flex-grow-1">{{ t('designer.files.visualInvalid', { error: outline.error }) }}</span>
      <BsButton icon="code" @click="emit('reveal', outline.line)">{{ t('designer.files.showInYaml') }}</BsButton>
    </div>
    <div v-else-if="outline.kind === 'empty' || !rows.length" class="empty-state">
      <FaIcon icon="file-code" class="empty-state-icon" />
      <span>{{ t('playbookOutline.empty') }}</span>
    </div>
    <template v-else>
      <p class="text-body-secondary mb-2">
        {{ t('playbookOutline.plays', playCount) }}, {{ t('playbookOutline.tasks', allTasks) }}
      </p>
      <div class="af-pb">
        <div
          v-for="row in shown"
          :key="row.id"
          class="af-pb-row"
          :class="`af-pb-${row.type}`"
          :style="{ paddingLeft: row.depth * 1.5 + 0.5 + 'rem' }"
        >
          <span v-if="foldable(row)" role="button" class="af-pb-caret" @click="toggle(row.id)"
            ><FaIcon :icon="folded.has(row.id) ? 'caret-right' : 'caret-down'"
          /></span>
          <span v-else class="af-pb-caret"></span>
          <FaIcon
            :icon="row.type === 'section' ? SECTION_ICONS[row.key] || 'list' : ICONS[row.type]"
            class="me-2 af-pb-icon"
            :class="`af-pb-icon-${row.type === 'section' ? row.key : row.type}`"
          />
          <!-- its name (a section : what it is) ; a click opens the YAML there -->
          <span
            role="button"
            class="af-pb-name me-2"
            :class="{ 'fst-italic text-body-secondary': row.type === 'task' && !row.name }"
            :title="t('designer.files.showInYaml')"
            @click="emit('reveal', row.line)"
          >
            <template v-if="row.type === 'section'">{{ t(`playbookOutline.sections.${row.key}`) }}</template>
            <template v-else-if="row.type === 'import'">{{ t('playbookOutline.import', { name: row.name }) }}</template>
            <template v-else-if="row.type === 'block'">{{ row.name || t('playbookOutline.sections.block') }}</template>
            <template v-else-if="row.type === 'task'">{{ row.name || row.module || '?' }}</template>
            <template v-else>{{ row.name || t('playbookOutline.unnamed') }}</template>
          </span>
          <!-- a play : its hosts, become, no facts gathered -->
          <template v-if="row.type === 'play'">
            <span v-if="row.hosts" class="badge af-badge me-1"
              ><FaIcon icon="server" class="me-1" />{{ row.hosts }}</span
            >
            <span v-if="row.become" class="badge af-badge me-1"><FaIcon icon="user-shield" class="me-1" />become</span>
            <span v-if="!row.gather_facts" class="badge af-badge me-1">{{ t('playbookOutline.noFacts') }}</span>
          </template>
          <!-- a section : how many it holds -->
          <span v-else-if="row.type === 'section'" class="text-body-secondary small">{{ row.count }}</span>
          <!-- a task : its module (when it has a name to show besides), what it brings in -->
          <template v-else-if="row.type === 'task'">
            <span v-if="row.name && row.module" class="badge af-badge af-pb-module me-1">{{ row.module }}</span>
            <span v-if="row.include" class="badge text-bg-primary me-1"
              ><FaIcon icon="file-import" class="me-1" />{{ row.include }}</span
            >
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
/* as the inventories' tree (AppInventoryTree) */
.af-pb {
  border: 1px solid rgba(var(--bs-emphasis-color-rgb), 0.25);
  border-radius: 0.375rem;
  padding: 0.25rem 0;
}
.af-pb-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  padding-right: 0.5rem;
}
.af-pb-row:hover {
  background-color: rgba(var(--bs-primary-rgb), 0.08);
}
.af-pb-play .af-pb-name,
.af-pb-import .af-pb-name {
  font-weight: 600;
}
.af-pb-section .af-pb-name {
  font-weight: 600;
  color: var(--bs-secondary-color);
}
.af-pb-name:hover {
  text-decoration: underline;
}
.af-pb-caret {
  display: inline-block;
  width: 1rem;
  text-align: center;
  color: var(--bs-secondary-color);
  margin-right: 0.25rem;
}
.af-pb-icon {
  color: var(--bs-secondary-color);
}
.af-pb-icon-play {
  color: var(--bs-success);
}
.af-pb-icon-handlers {
  color: var(--bs-warning);
}
.af-pb-icon-rescue {
  color: var(--bs-danger);
}
.af-badge {
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  border: 1px solid var(--bs-border-color);
  font-weight: 500;
}
.af-pb-module {
  font-family: var(--bs-font-monospace);
  font-weight: 400;
}
</style>
