<script setup>
/******************************************************************/
/*                                                                */
/*  An inventory as a tree : its groups, their child groups and   */
/*  their hosts, how many variables each sets in the inventory,   */
/*  and a link to its group_vars or host_vars file when it has    */
/*  one. A group folds ; a row opens the YAML on its line.        */
/*                                                                */
/*  @props:                                                       */
/*      inventory: Object - inventoryOf (config/inventoryTree.js) */
/*      groupVars: Array - the groups with a group_vars file      */
/*      hostVars: Array - the hosts with a host_vars file         */
/*  @emits:                                                       */
/*      reveal: the line to open the YAML on                      */
/*      open: { role, name } - a group's or a host's vars file    */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { inventoryRows } from '@/config/inventoryTree';

const props = defineProps({
  inventory: { type: Object, required: true },
  groupVars: { type: Array, default: () => [] },
  hostVars: { type: Array, default: () => [] },
  // the inventory file's own name (inventory.yaml, hosts.yml) : the badge of the variables written in it
  fileName: { type: String, default: 'inventory.yaml' },
});
const emit = defineEmits(['reveal', 'open']);
const { t } = useI18n();

const rows = computed(() => inventoryRows(props.inventory.groups || []));
const groupCount = computed(() => rows.value.filter((r) => r.type === 'group').length);
const folded = ref(new Set());
// a row shows unless a group above it is folded
const shown = computed(() =>
  rows.value.filter((r) => {
    const id = r.type === 'host' ? r.parent : r.id;
    const parts = id.split('/');
    const upTo = r.type === 'host' ? parts.length : parts.length - 1;
    for (let i = 1; i <= upTo; i++) if (folded.value.has(parts.slice(0, i).join('/'))) return false;
    return true;
  }),
);
function toggle(id) {
  const next = new Set(folded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  folded.value = next;
}
</script>
<template>
  <div>
    <!-- a dynamic inventory : its plugin reads the hosts when the playbook runs -->
    <div v-if="inventory.kind === 'plugin'" class="alert alert-info d-flex align-items-center gap-2">
      <FaIcon icon="plug" />
      <span>{{ t('designer.files.inventoryPlugin', { plugin: inventory.plugin }) }}</span>
    </div>
    <div v-else-if="inventory.kind === 'empty' || !rows.length" class="empty-state">
      <FaIcon icon="sitemap" class="empty-state-icon" />
      <span>{{ t('designer.files.inventoryEmpty') }}</span>
    </div>
    <template v-else>
      <p class="text-body-secondary mb-2">
        {{ t('designer.files.groupsCount', groupCount) }}, {{ t('designer.files.hostsCount', inventory.hosts) }}
      </p>
      <div class="af-inv">
        <div
          v-for="row in shown"
          :key="row.id"
          class="af-inv-row"
          :class="{ 'af-inv-group': row.type === 'group' }"
          :style="{ paddingLeft: row.depth * 1.5 + 0.5 + 'rem' }"
        >
          <span
            v-if="row.type === 'group'"
            role="button"
            class="af-inv-caret"
            :class="{ invisible: !row.count }"
            @click="toggle(row.id)"
            ><FaIcon :icon="folded.has(row.id) ? 'caret-right' : 'caret-down'"
          /></span>
          <span v-else class="af-inv-caret"></span>
          <FaIcon
            :icon="row.type === 'group' ? 'layer-group' : 'server'"
            class="me-2"
            :class="row.type === 'group' ? 'af-inv-group' : 'text-secondary'"
          />
          <span
            role="button"
            class="af-inv-name me-2"
            :title="t('designer.files.showInYaml')"
            @click="emit('reveal', row.line)"
            >{{ row.name }}</span
          >
          <!-- two places a group or host gets variables from : under it in this inventory file
               (the inventory file, its count in the title), and its own group_vars / host_vars file next to it (opened) -->
          <span
            v-if="row.vars"
            class="badge af-badge me-1"
            :title="
              t('designer.files.inlineVarsTitle', {
                count: t('designer.files.varsCount', row.vars),
                name: row.name,
                file: fileName,
              })
            "
            >{{ t('designer.files.inventoryFileVars', { file: fileName }) }}</span
          >
          <span
            v-if="row.type === 'group' ? groupVars.includes(row.name) : hostVars.includes(row.name)"
            role="button"
            class="badge text-bg-primary me-1"
            :title="
              t('designer.files.varsFileTitle', {
                file: `${row.type === 'group' ? 'group_vars' : 'host_vars'}/${row.name}`,
              })
            "
            @click="emit('open', { role: row.type === 'group' ? 'group_vars' : 'host_vars', name: row.name })"
            ><FaIcon icon="file-lines" class="me-1" />{{
              row.type === 'group' ? t('designer.files.groupVarsFile') : t('designer.files.hostVarsFile')
            }}</span
          >
        </div>
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
.af-inv {
  border: 1px solid rgba(var(--bs-emphasis-color-rgb), 0.25);
  border-radius: 0.375rem;
  padding: 0.25rem 0;
}
.af-inv-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  padding-right: 0.5rem;
}
.af-inv-row:hover {
  background-color: rgba(var(--bs-primary-rgb), 0.08);
}
.af-inv-group .af-inv-name {
  font-weight: 600;
}
.af-inv-name:hover {
  text-decoration: underline;
}
.af-inv-caret {
  display: inline-block;
  width: 1rem;
  text-align: center;
  color: var(--bs-secondary-color);
  margin-right: 0.25rem;
}
/* a group : a set of hosts, not a folder on disk (its fold is the caret beside it) ; the
   link blue, apart from the explorer's yellow folders */
.af-inv-group {
  color: var(--bs-primary);
}
.af-badge {
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  border: 1px solid var(--bs-border-color);
  font-weight: 500;
}
</style>
