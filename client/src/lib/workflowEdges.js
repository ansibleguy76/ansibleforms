// The links of a workflow job's graph, as AppAwxWorkflow draws them : AWX and AAP link a node to
// its children on success, on failure or always ; Ascender adds conditional links, taken on the
// parent's outcome (their trigger) when an artifact of the parent matches a value.

/**
 * The links between the nodes of a workflow, those to a node not in it left out.
 *
 * Args:
 *   nodes (object[]): the nodes ({ id, success_nodes, failure_nodes, always_nodes,
 *     condition_edges }).
 *
 * Returns:
 *   object[]: [{ from, to, type }] ; a conditional one has type 'condition', its trigger
 *     (success, failure, always) and its condition ({ key, operator, value }, null when unknown).
 */
export function workflowEdges(nodes) {
  const ids = new Set((nodes || []).map((n) => n.id));
  const edges = [];
  (nodes || []).forEach((n) => {
    (n.success_nodes || []).forEach((c) => ids.has(c) && edges.push({ from: n.id, to: c, type: 'success' }));
    (n.failure_nodes || []).forEach((c) => ids.has(c) && edges.push({ from: n.id, to: c, type: 'failure' }));
    (n.always_nodes || []).forEach((c) => ids.has(c) && edges.push({ from: n.id, to: c, type: 'always' }));
    (n.condition_edges || []).forEach((e) => {
      if (!e || !ids.has(e.id)) return;
      edges.push({
        from: n.id,
        to: e.id,
        type: 'condition',
        trigger: ['success', 'failure', 'always'].includes(e.trigger) ? e.trigger : 'success',
        condition: e.artifact_key
          ? { key: e.artifact_key, operator: e.operator === 'ne' ? 'ne' : 'eq', value: e.expected_value ?? '' }
          : null,
      });
    });
  });
  return edges;
}

/**
 * A conditional link's condition, as it reads on the graph : deploy = true, env ≠ "prod".
 *
 * Args:
 *   condition (object): { key, operator, value }, or null.
 *
 * Returns:
 *   string: the condition, '' when unknown.
 */
export function conditionText(condition) {
  if (!condition) return '';
  return `${condition.key} ${condition.operator === 'ne' ? '≠' : '='} ${condition.value}`;
}
