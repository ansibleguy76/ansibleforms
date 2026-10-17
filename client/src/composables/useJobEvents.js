/******************************************************************/
/*                                                                */
/*  A playbook job's structured events, for the hosts-and-tasks   */
/*  panel (components/AppJobEvents.vue) : read with the job,      */
/*  shown on demand. A job's page and the form's output use it.   */
/*                                                                */
/******************************************************************/
import { ref } from 'vue';
import axios from 'axios';

/**
 * The events of the job shown, and whether their panel is open.
 *
 * Returns:
 *   { jobEvents: Ref<object[]>, showEvents: Ref<boolean>, loadEvents: function }:
 *     loadEvents(id, jobType) reads them again ; another job starts with none and the panel closed.
 */
export function useJobEvents() {
  const jobEvents = ref([]);
  const showEvents = ref(false);
  let eventsOf = null;

  /**
   * Reads a job's events (a playbook job's only).
   *
   * Args:
   *   id (number): the job.
   *   jobType (string): its type ; none but ansible has events.
   */
  async function loadEvents(id, jobType) {
    if (eventsOf !== id) {
      eventsOf = id;
      jobEvents.value = [];
      showEvents.value = false;
    }
    if (!id || (jobType && jobType !== 'ansible')) return;
    try {
      const res = await axios.get(`/api/v2/job/${id}/events`);
      if (eventsOf === id) jobEvents.value = res.data?.records || [];
    } catch {
      // none, or an older server : no panel
    }
  }

  return { jobEvents, showEvents, loadEvents };
}

export default useJobEvents;
