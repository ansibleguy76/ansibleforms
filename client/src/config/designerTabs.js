// The designer's sections and the tabs each one has, by its address (/designer/<section>/<tab>).
// One list for the router (an address of a section or a tab that does not exist is not found) and
// for the designer (which tabs it shows).

/** Each section's tabs : its YAML always, its Visual and its Preview when it has them. */
export const DESIGNER_TABS = {
  categories: ['yaml', 'visual', 'preview'],
  constants: ['yaml', 'visual'],
  forms: ['yaml', 'visual', 'preview'],
  // an inventory's groups and hosts, its vars files' variables
  inventories: ['yaml', 'visual'],
  // a playbook is code, edited as YAML
  playbooks: ['yaml'],
  varsfiles: ['yaml', 'visual'],
  // a workflow as its graph (the Visual tab), its job templates under it
  workflows: ['yaml', 'visual'],
};

/** Every tab a section may have. */
const EDITORS = ['yaml', 'visual', 'preview'];

/**
 * Whether a designer address names what the designer has : a section of it, a tab of that
 * section, nothing more ; a form in the forms section (/designer/forms/<form>/<tab>).
 *
 * Args:
 *   params (object): the route's params - view (the section), item, editor.
 *
 * Returns:
 *   boolean: false for an address to answer as not found.
 */
export function designerAddressExists({ view, item, editor } = {}) {
  if (!view) return !item && !editor;
  const tabs = DESIGNER_TABS[view];
  if (!tabs) return false;
  if (view === 'forms') {
    // /designer/forms/<tab>, or /designer/forms/<form>[/<tab>]
    if (item && EDITORS.includes(item)) return !editor && tabs.includes(item);
    return !editor || tabs.includes(editor);
  }
  if (editor) return false;
  return !item || tabs.includes(item);
}
