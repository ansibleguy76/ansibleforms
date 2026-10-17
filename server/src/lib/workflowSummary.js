// The summary a workflow job ends with, on the RTE (models/workflowRun.js) as on an AWX, AAP or
// Ascender (runners/awx/api.js) : a line per node, its number, its name and its status, the
// statuses in one column - the job output colours the status alone (lib/common.js formatOutput),
// so a failed node stands out among the others.
//
//   WORKFLOW NODE #1  [validate-request]                : successful
//   WORKFLOW NODE #13 [create-dns-records]              : failed

/**
 * The summary's lines, one per node.
 *
 * Args:
 *   nodes (object[]): the nodes in their order, { id (their number), name, status }.
 *
 * Returns:
 *   string[]: the lines.
 */
export function workflowSummaryLines(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const idWidth = Math.max(0, ...list.map((n) => String(n.id ?? "").length));
  // every status in one column : the names padded to the longest
  const nameWidth = Math.max(0, ...list.map((n) => String(n.name ?? "").length));
  return list.map((n) => {
    const id = `#${n.id ?? ""}`.padEnd(idWidth + 1);
    const name = `[${n.name ?? ""}]`.padEnd(nameWidth + 2);
    return `WORKFLOW NODE ${id} ${name} : ${n.status || "pending"}`;
  });
}

export default { workflowSummaryLines };
