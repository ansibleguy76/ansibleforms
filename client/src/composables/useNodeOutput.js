// A workflow node's output, opened from its graph (components/AppAwxWorkflow.vue's node event) :
// its section of the job's output, shown in a dialog (components/AppNodeOutputDialog.vue). A
// job's page and the form's output use it.
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

/**
 * The node shown and how to open it.
 *
 * Args:
 *   output (Ref): the job's output (an AppAnsibleOutput, its nodeOutput).
 *
 * Returns:
 *   object: { nodeShown (a ref : { node, html } or null), openNodeOutput (node) }.
 */
export function useNodeOutput(output) {
  const { t } = useI18n();
  const nodeShown = ref(null);

  /**
   * Opens a node's output in the dialog : its section of the job's output ; none yet (the node
   * did not run, or its output has not come), a toast says so.
   *
   * Args:
   *   node (object): the node clicked on the graph.
   */
  function openNodeOutput(node) {
    const html = output.value?.nodeOutput(node);
    if (!html) {
      toast.info(t('jobs.noNodeOutput', { node: node.name }));
      return;
    }
    nodeShown.value = { node, html };
  }

  return { nodeShown, openNodeOutput };
}

export default useNodeOutput;
