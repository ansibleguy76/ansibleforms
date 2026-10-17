<script setup>
/******************************************************************/
/*                                                                */
/*  AppTimePreview : the time now as AnsibleForms shows it in a   */
/*  zone and a date format - a box with a clock, the time, and    */
/*  under it the zone and its offset from UTC. It ticks along     */
/*  while the page is open and follows its zone and format at     */
/*  once. Profile > Preferences (the user's picks) and Settings > */
/*  Appearance > Defaults (everyone's defaults) show it.          */
/*                                                                */
/*  @props:                                                       */
/*      zone: String - an IANA zone, or 'browser' (lib/Time.js)   */
/*      format: String - the date part's pattern (YYYY-MM-DD ...) */
/*                                                                */
/******************************************************************/
import { ref, computed, onBeforeUnmount } from 'vue';
import dayjs from 'dayjs';
import Time, { BROWSER } from '@/lib/Time';

const props = defineProps({
  zone: { type: String, default: 'UTC' },
  format: { type: String, default: 'YYYY-MM-DD' },
});

// the clock : a tick every 30 seconds is enough for minutes
const now = ref(new Date());
const timer = setInterval(() => (now.value = new Date()), 30000);
onBeforeUnmount(() => clearInterval(timer));

// the zone meant : the browser's own for 'browser'
const zone = computed(() => (props.zone === BROWSER ? Time.browserZone() : props.zone || 'UTC'));
// the time in that zone and format, with the zone's short name (CEST, UTC ...)
const time = computed(() => {
  try {
    const text = dayjs(now.value).tz(zone.value).format(`${props.format} HH:mm`);
    const name = Time.zoneName(now.value, zone.value);
    return name ? `${text} ${name}` : text;
  } catch {
    return dayjs(now.value).utc().format(`${props.format} HH:mm`) + ' UTC';
  }
});
// the zone's offset from UTC now (summer time included), as UTC+02:00 ; UTC itself needs none
const offset = computed(() => {
  if (zone.value === 'UTC') return '';
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone.value, timeZoneName: 'longOffset' })
      .formatToParts(now.value)
      .find((p) => p.type === 'timeZoneName')?.value;
    // 'GMT+02:00', or plain 'GMT' for a zone on UTC time
    return part ? part.replace('GMT', 'UTC').replace(/^UTC$/, 'UTC+00:00') : '';
  } catch {
    return '';
  }
});
</script>

<template>
  <div class="af-tz-now">
    <span class="af-tz-now-icon"><FaIcon icon="clock" /></span>
    <span class="d-flex flex-column">
      <span class="af-tz-now-time">{{ time }}</span>
      <small class="text-body-secondary"
        >{{ zone }}<template v-if="offset"> · {{ offset }}</template></small
      >
    </span>
  </div>
</template>

<style scoped>
.af-tz-now {
  /* a box of its own (not on a text line : no line's room under it), as wide as its text */
  display: flex;
  width: max-content;
  max-width: 100%;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
}
.af-tz-now-icon {
  font-size: 1.5rem;
  color: var(--af-primary);
}
.af-tz-now-time {
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
