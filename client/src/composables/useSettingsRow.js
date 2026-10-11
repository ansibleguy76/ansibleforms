/******************************************************************/
/*                                                                */
/*  useSettingsRow : some fields of the settings row, edited on a */
/*  page of Settings > Appearance (Interface, Name, Environment,  */
/*  Announcement). Loads them, says when they                     */
/*  changed, saves only them (PUT /api/v2/settings takes a part)  */
/*  and refreshes the app's look at once (/api/v2/app/config).    */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import Helpers from '@/lib/Helpers';
import State from '@/lib/State';

/**
 * The fields of the settings row a page edits.
 *
 * Args:
 *   fieldsOf (Function): row => the fields as the page edits them (its defaults when empty).
 *   toPayload (Function): fields => what is sent to the server (default: as they are).
 *
 * Returns:
 *   object: { edit (a ref : the fields as edited), dirty, load, save (message) => boolean }.
 */
export function useSettingsRow(fieldsOf, toPayload = (fields) => fields) {
  const edit = ref(fieldsOf({}));
  const saved = ref(null);
  const dirty = computed(() => !!saved.value && JSON.stringify(edit.value) !== JSON.stringify(saved.value));

  /**
   * Loads the fields from the settings row.
   */
  async function load() {
    try {
      const result = await axios.get('/api/v2/settings/');
      edit.value = fieldsOf(result.data);
      saved.value = fieldsOf(result.data);
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
    }
  }

  /**
   * Saves the fields when they changed, then refreshes what the app shows of them.
   *
   * Args:
   *   message (string): what is said once saved.
   *
   * Returns:
   *   boolean: false when the save was refused.
   */
  async function save(message) {
    if (!dirty.value) return true;
    try {
      await axios.put('/api/v2/settings/', toPayload({ ...edit.value }));
      toast.success(message);
      await load();
      await State.loadAppConfig();
      return true;
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
      return false;
    }
  }

  return { edit, dirty, load, save };
}
