/******************************************************************/
/*                                                                */
/*  The forms as the settings pages link them : the roles that    */
/*  open each, and where its jobs run (/api/v2/config/formslinked */
/*  , server lib/formLinks.js). The Forms tabs of a role, a       */
/*  group, a user and a runner read them here.                    */
/*                                                                */
/******************************************************************/
import { ref } from 'vue';
import axios from 'axios';

/**
 * The forms and who opens them, where they run.
 *
 * Returns:
 *   object: { forms, loadForms, formsOfRoles, formsOfRunner }.
 */
export function useFormLinks() {
  const forms = ref([]); // each { name, description, type, roles, runs }

  /**
   * Loads the forms ; none when they cannot be read (the tab then says there are none).
   */
  async function loadForms() {
    try {
      const res = await axios.get('/api/v2/config/formslinked');
      forms.value = res.data.records || res.data || [];
    } catch {
      forms.value = [];
    }
  }

  /**
   * The forms some roles open, by the server's rule (Form checkFormRole) : the admin role
   * opens every form, any other the forms that name it.
   *
   * Args:
   *   roleNames (string[]): the roles (a user's, a group's, or one role).
   *
   * Returns:
   *   object[]: the forms, each with `through` - the roles that open it.
   */
  function formsOfRoles(roleNames) {
    const names = new Set(roleNames);
    return forms.value
      .map((f) => ({
        ...f,
        through: names.has('admin') ? ['admin'] : f.roles.filter((r) => names.has(r)),
      }))
      .filter((f) => f.through.length);
  }

  /**
   * The forms whose jobs run on a runner : those that name it, and, when it is the default of
   * its type, those that name none and need that type.
   *
   * Args:
   *   runner (object): the runner, { name, type, is_default }.
   *
   * Returns:
   *   object[]: the forms, each with `byDefault` - it takes the runner as the default.
   */
  function formsOfRunner(runner) {
    if (!runner) return [];
    const out = [];
    for (const f of forms.value) {
      const named = f.runs.some((r) => r.runner === runner.name);
      const byDefault = !!runner.is_default && f.runs.some((r) => r.defaultType === runner.type);
      if (named || byDefault) out.push({ ...f, byDefault: !named && byDefault });
    }
    return out;
  }

  return { forms, loadForms, formsOfRoles, formsOfRunner };
}
