<script setup>
/******************************************************************/
/*                                                                */
/*  Bootstrap Date Time component                                 */
/*                                                                */
/*  @props:                                                       */
/*      hasError: Boolean                                         */
/*      name: String                                              */
/*      dateType: String                                          */
/*      icon: String                                              */
/*      placeholder: String - shown while empty ; none, the       */
/*         format of its type (YYYY-MM-DD HH:mm for datetime)     */
/*      teleport: Boolean - the calendar opened on the page's     */
/*         body : in a dialog, whose scrolling body would cut it  */
/*         off                                                    */
/*      convertToUtc: Boolean - a datetime that is a moment, sent */
/*         as a UTC ISO string. It is picked on the app's time    */
/*         zone (Time.zone(), the one every page shows), and a    */
/*         switch in the calendar moves it to the browser's zone  */
/*         and back : the moment stays, only the clock changes    */
/*                                                                */
/*  @emit:                                                        */
/*      change: Event                                              */
/*                                                                */
/******************************************************************/

import { computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useI18n } from 'vue-i18n';
import Time from '@/lib/Time';

// MODEL

const model = defineModel();

// INIT

const store = useAppStore();
const emit = defineEmits(['change', 'update:model-value']);

// PROPS

const props = defineProps({
  hasError: { type: Boolean, default: false },
  name: { type: String, default: '' },
  dateType: { type: String, default: 'date' },
  icon: { type: String, default: 'calendar' },
  placeholder: { type: String, default: '' },
  convertToUtc: { type: Boolean, default: false },
  teleport: { type: Boolean, default: false },
});

// DATA

const { t, te } = useI18n();
// empty, the field shows what it takes, as it will show it (YYYY-MM-DD HH:mm for a date and
// time) : the placeholder given, or the one of its type
const shownPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  const key = `settings.common.datePlaceholders.${props.dateType}`;
  return te(key) ? t(key) : '';
});
const hasFocus = ref(false);
const tempValue = ref('');
const pickerModel = ref(null); // Local timezone Date for picker
// the zone a moment is picked on, when the user switched it ; else the app's zone
const pickedZone = ref(null);

// COMPUTED

const theme = computed(() => store.theme);
const hasTimePicker = computed(() => {
  return ['datetime', 'time'].includes(props.dateType);
});
// a moment (sent as UTC) : picked on a zone's clock. Without convertToUtc a datetime is a wall
// clock with no zone (a form field), and stays on the browser's local Date as before
const isMoment = computed(() => props.dateType === 'datetime' && props.convertToUtc);
const appZone = computed(() => Time.zone());
const browserZone = Time.browserZone();
const zone = computed(() => pickedZone.value || appZone.value);
// the moment shown (else now), for the zones' names and offsets : summer and winter differ
const shownMoment = computed(() => {
  const iso = pickerModel.value instanceof Date ? Time.fromWallClock(pickerModel.value, zone.value) : '';
  return iso ? new Date(iso) : new Date();
});
function offsetOf(z) {
  return Time.toWallClock(shownMoment.value, z)?.getTime() ?? 0;
}
// both zones on the same clock (the app on the browser's zone, or two zones with one offset) :
// nothing to switch
const zonesDiffer = computed(() => isMoment.value && offsetOf(appZone.value) !== offsetOf(browserZone));
const zoneCards = computed(() => [
  {
    zone: browserZone,
    name: Time.zoneName(shownMoment.value, browserZone),
    title: t('settings.common.zoneBrowser', { zone: browserZone }),
  },
  {
    zone: appZone.value,
    name: Time.zoneName(shownMoment.value, appZone.value),
    title: t('settings.common.zoneApp', { zone: appZone.value }),
  },
]);
// the moment on both clocks, the picked one first : nothing ambiguous before saving
const bothClocks = computed(() => {
  if (!zonesDiffer.value || !(pickerModel.value instanceof Date)) return '';
  const iso = Time.fromWallClock(pickerModel.value, zone.value);
  if (!iso) return '';
  const other = zone.value === browserZone ? appZone.value : browserZone;
  return [zone.value, other]
    .map((z) => {
      const w = Time.toWallClock(iso, z);
      return `${fmtWall(w)} ${Time.zoneName(new Date(iso), z)}`;
    })
    .join(' · ');
});

// METHODS

function fmtWall(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

// the same moment on another zone's clock
function switchZone(next) {
  if (next === zone.value) return;
  const iso = pickerModel.value instanceof Date ? Time.fromWallClock(pickerModel.value, zone.value) : '';
  pickedZone.value = next === appZone.value ? null : next;
  if (iso) pickerModel.value = Time.toWallClock(iso, zone.value);
}

function getWeekNumber(date) {
  // ISO week number calculation
  const dayNum = date.getDay() || 7;
  const tempWeekDate = new Date(date);
  tempWeekDate.setDate(date.getDate() + 4 - dayNum);
  const yearStart = new Date(tempWeekDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((tempWeekDate - yearStart) / 86400000 + 1) / 7);
  return { weekNumber, year: tempWeekDate.getFullYear() };
}

function focus(_event) {
  hasFocus.value = true;
}

function blur(_event) {
  hasFocus.value = false;
  // Sync picker to output when losing focus
  syncToOutput();
}

function input(value) {
  // Called when VueDatePicker value changes through GUI
  syncToOutput();
  emit('change', value);
}

function syncToOutput() {
  // Convert pickerModel (local time) to model output
  if (!pickerModel.value) {
    model.value = null;
    return;
  }

  const localDate = pickerModel.value;

  // Pass through native formats (time/month/week objects/arrays)
  if (props.dateType === 'time' && typeof localDate === 'object' && 'hours' in localDate) {
    model.value = localDate;
  } else if (props.dateType === 'month' && typeof localDate === 'object' && 'month' in localDate) {
    model.value = localDate;
  } else if (props.dateType === 'week' && Array.isArray(localDate)) {
    model.value = localDate;
  } else if (localDate instanceof Date) {
    // Convert Date objects to appropriate format
    if (props.dateType === 'date') {
      // Always use local date (no UTC conversion - would cause wrong dates near timezone boundaries)
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      model.value = `${year}-${month}-${day}`;
    } else if (props.dateType === 'datetime') {
      if (props.convertToUtc) {
        // the wall clock picked, on the zone picked, as a UTC ISO string
        model.value = Time.fromWallClock(localDate, zone.value) || null;
      } else {
        // Use local datetime without timezone conversion
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const hour = String(localDate.getHours()).padStart(2, '0');
        const minute = String(localDate.getMinutes()).padStart(2, '0');
        const second = String(localDate.getSeconds()).padStart(2, '0');
        model.value = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      }
    } else if (props.dateType === 'year') {
      // Always use local year (no UTC conversion - would cause wrong year near New Year)
      model.value = String(localDate.getFullYear());
    }
  }
}

function loadFromOutput() {
  // Convert model output to pickerModel (local time)
  if (!model.value) {
    pickerModel.value = null;
    tempValue.value = '';
    return;
  }

  // Pass through native formats for pickers
  if (props.dateType === 'time' && typeof model.value === 'object' && 'hours' in model.value) {
    pickerModel.value = model.value;
  } else if (props.dateType === 'month' && typeof model.value === 'object' && 'month' in model.value) {
    pickerModel.value = model.value;
  } else if (props.dateType === 'week' && Array.isArray(model.value)) {
    pickerModel.value = model.value;
  } else if (typeof model.value === 'string') {
    // Parse string based on dateType
    if (props.dateType === 'time') {
      // Parse time string (HH:mm or HH:mm:ss format)
      const timeParts = model.value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (timeParts) {
        const hours = parseInt(timeParts[1]);
        const minutes = parseInt(timeParts[2]);
        const seconds = timeParts[3] ? parseInt(timeParts[3]) : 0;
        pickerModel.value = { hours, minutes, seconds };
      } else {
        pickerModel.value = null;
      }
    } else if (props.dateType === 'month') {
      // Parse month string (YYYY-MM format)
      const monthParts = model.value.match(/^(\d{4})-(\d{2})$/);
      if (monthParts) {
        const year = parseInt(monthParts[1]);
        const month = parseInt(monthParts[2]) - 1;
        pickerModel.value = { month, year };
      } else {
        pickerModel.value = null;
      }
    } else if (props.dateType === 'week') {
      // Parse week string (YYYY-W## format)
      const weekParts = model.value.match(/^(\d{4})-W(\d{2})$/);
      if (weekParts) {
        const year = parseInt(weekParts[1]);
        const week = parseInt(weekParts[2]);

        const jan4 = new Date(year, 0, 4);
        const jan4Day = jan4.getDay() || 7;
        const week1Start = new Date(jan4);
        week1Start.setDate(jan4.getDate() - jan4Day + 1);

        const monday = new Date(week1Start);
        monday.setDate(week1Start.getDate() + (week - 1) * 7);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        pickerModel.value = [
          new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())).toISOString(),
          new Date(Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999)).toISOString(),
        ];
      } else {
        pickerModel.value = null;
      }
    } else if (props.dateType === 'date') {
      // Always parse as local date (YYYY-MM-DD format)
      const dateParts = model.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateParts) {
        const [, year, month, day] = dateParts.map(Number);
        pickerModel.value = new Date(year, month - 1, day);
      } else {
        pickerModel.value = null;
      }
    } else if (props.dateType === 'year') {
      // Always parse as local year (YYYY format)
      const yearMatch = model.value.match(/^(\d{4})$/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        pickerModel.value = new Date(year, 0, 1);
      } else {
        pickerModel.value = null;
      }
    } else if (props.dateType === 'datetime') {
      if (props.convertToUtc) {
        // a UTC ISO string, shown on the clock of the zone picked : 2026-03-09T12:00:00.000Z
        // is 12:00 on UTC and 13:00 on Europe/Madrid
        pickerModel.value = Time.toWallClock(model.value, zone.value);
      } else {
        // Local datetime string (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss format)
        const separator = model.value.includes('T') ? 'T' : ' ';
        const [datePart, timePart] = model.value.split(separator);
        if (datePart && timePart) {
          const [year, month, day] = datePart.split('-').map(Number);
          const timeComponents = timePart.split(':').map(Number);
          const hour = timeComponents[0] || 0;
          const minute = timeComponents[1] || 0;
          const second = timeComponents[2] || 0;
          pickerModel.value = new Date(year, month - 1, day, hour, minute, second);
        } else {
          pickerModel.value = null;
        }
      }
    } else {
      // Fallback to standard parsing for unknown types
      pickerModel.value = new Date(model.value);
    }
  } else {
    // If it's not a recognized format, set to null
    pickerModel.value = null;
  }

  updateTempValue();
}

function updateTempValue() {
  // Format pickerModel (local time) for display
  if (!pickerModel.value) {
    tempValue.value = '';
    return;
  }

  const value = pickerModel.value;

  // Handle object types from VueDatePicker (time, month)
  if (props.dateType === 'time' && typeof value === 'object' && 'hours' in value) {
    const hour = value.hours.toString().padStart(2, '0');
    const minute = value.minutes.toString().padStart(2, '0');
    tempValue.value = `${hour}:${minute}`;
    return;
  }

  if (props.dateType === 'month' && typeof value === 'object' && 'month' in value) {
    const month = (value.month + 1).toString().padStart(2, '0');
    const year = value.year;
    tempValue.value = `${year}-${month}`;
    return;
  }

  if (props.dateType === 'week' && Array.isArray(value)) {
    const utcDate = new Date(value[0]);
    const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
    const { weekNumber, year } = getWeekNumber(localDate);
    tempValue.value = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    return;
  }

  // Handle Date objects
  if (!(value instanceof Date)) {
    tempValue.value = '';
    return;
  }

  const date = value;
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  if (props.dateType === 'date') {
    tempValue.value = `${year}-${month}-${day}`;
  } else if (props.dateType === 'datetime') {
    tempValue.value = `${year}-${month}-${day} ${hour}:${minute}`;
  } else if (props.dateType === 'time') {
    tempValue.value = `${hour}:${minute}`;
  } else if (props.dateType === 'month') {
    tempValue.value = `${year}-${month}`;
  } else if (props.dateType === 'year') {
    tempValue.value = `${year}`;
  } else if (props.dateType === 'week') {
    const { weekNumber, year: weekYear } = getWeekNumber(date);
    tempValue.value = `${weekYear}-W${weekNumber.toString().padStart(2, '0')}`;
  }
}

function handleTempInput(event) {
  // Parse the temp input and update pickerModel (local time)
  const inputStr = event.target.value;
  tempValue.value = inputStr;

  if (!inputStr) {
    pickerModel.value = null;
    return;
  }

  let parsed;

  if (props.dateType === 'time') {
    // Parse time (HH:mm format) - VueDatePicker expects object
    const timeParts = inputStr.match(/^(\d{1,2}):(\d{2})$/);
    if (timeParts) {
      const hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      pickerModel.value = { hours, minutes, seconds: 0 };
    }
  } else if (props.dateType === 'month') {
    // Parse month (yyyy-MM format) - VueDatePicker expects object
    const monthParts = inputStr.match(/^(\d{4})-(\d{2})$/);
    if (monthParts) {
      const year = parseInt(monthParts[1]);
      const month = parseInt(monthParts[2]) - 1;
      pickerModel.value = { month, year };
    }
  } else if (props.dateType === 'week') {
    // Parse week (yyyy-W## format) - VueDatePicker expects array
    const weekParts = inputStr.match(/^(\d{4})-W(\d{2})$/);
    if (weekParts) {
      const year = parseInt(weekParts[1]);
      const week = parseInt(weekParts[2]);

      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7;
      const week1Start = new Date(jan4);
      week1Start.setDate(jan4.getDate() - jan4Day + 1);

      const monday = new Date(week1Start);
      monday.setDate(week1Start.getDate() + (week - 1) * 7);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      pickerModel.value = [
        new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())).toISOString(),
        new Date(Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999)).toISOString(),
      ];
    }
  } else if (props.dateType === 'year') {
    // Parse year (yyyy format) - local
    const yearMatch = inputStr.match(/^(\d{4})$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      parsed = new Date(year, 0, 1, 0, 0, 0, 0);
    }
  } else if (props.dateType === 'datetime') {
    // Parse datetime (yyyy-mm-dd HH:mm) - local time
    const dtParts = inputStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (dtParts) {
      const year = parseInt(dtParts[1]);
      const month = parseInt(dtParts[2]) - 1;
      const day = parseInt(dtParts[3]);
      const hours = parseInt(dtParts[4]);
      const minutes = parseInt(dtParts[5]);
      parsed = new Date(year, month, day, hours, minutes, 0, 0);
    }
  } else {
    // Parse date (yyyy-mm-dd) - local
    const dateParts = inputStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (dateParts) {
      const year = parseInt(dateParts[1]);
      const month = parseInt(dateParts[2]) - 1;
      const day = parseInt(dateParts[3]);
      parsed = new Date(year, month, day, 0, 0, 0, 0);
    }
  }

  if (parsed && !isNaN(parsed.getTime())) {
    pickerModel.value = parsed;
  }
}

// Initialize picker model from output
loadFromOutput();
// Sync to ensure output format is consistent
syncToOutput();

// Watch for model changes from outside to reload
watch(
  model,
  () => {
    if (!hasFocus.value) {
      // Only reload if not actively editing
      loadFromOutput();
    }
  },
  { deep: true },
);

// the app's zone changed (the profile) : the moment on its clock
watch(appZone, () => {
  if (isMoment.value && !pickedZone.value) loadFromOutput();
});

// Watch pickerModel changes to update display only
watch(
  pickerModel,
  () => {
    updateTempValue();
  },
  { deep: true },
);
</script>
<template>
  <VueDatePicker
    text-input
    v-model="pickerModel"
    @blur="blur"
    @focus="focus"
    @input="input"
    :auto-apply="['date', 'month', 'week'].includes(dateType)"
    :enable-time-picker="hasTimePicker"
    :month-picker="dateType == 'month'"
    :week-picker="dateType == 'week'"
    :quarter-picker="dateType == 'quarter'"
    :year-picker="dateType == 'year'"
    :time-picker="dateType == 'time'"
    :is-24="true"
    :dark="theme == 'dark'"
    :teleport="teleport ? 'body' : undefined"
  >
    <!-- the clock a moment is picked on : the browser's or the app's -->
    <template v-if="zonesDiffer" #menu-header>
      <div
        class="btn-group btn-group-sm w-100 p-2 af-zone-switch"
        role="group"
        :aria-label="t('settings.common.zonePick')"
      >
        <button
          v-for="card in zoneCards"
          :key="card.zone"
          type="button"
          class="btn"
          :class="card.zone === zone ? 'btn-primary' : 'btn-outline-secondary'"
          :title="card.title"
          :aria-pressed="card.zone === zone"
          @click.stop="switchZone(card.zone)"
        >
          {{ card.name }}
        </button>
      </div>
    </template>
    <template #dp-input>
      <div class="input-group mt-2">
        <span class="input-group-text" :class="{ 'text-body': hasFocus, 'text-gray-500': !hasFocus }">
          <FaIcon :fixedwidth="true" :icon="icon" />
          <!-- the zone the moment is shown on ; at the start, the calendar's clear button sits at the end -->
          <span v-if="isMoment" class="ms-2 small" :title="zone">{{ Time.zoneName(shownMoment, zone) }}</span>
        </span>
        <input
          v-model="tempValue"
          @input="handleTempInput"
          @blur="blur"
          @focus="focus"
          :class="{ 'is-invalid': hasError }"
          class="form-control"
          type="text"
          :placeholder="shownPlaceholder"
          :name="name"
        />
      </div>
    </template>
  </VueDatePicker>
  <small v-if="bothClocks" class="form-text text-muted d-block af-both-clocks">{{ bothClocks }}</small>
</template>
<style scoped lang="scss">
.invalid-feedback {
  display: block !important;
}
</style>
<style lang="scss">
/* the zone switch, in the calendar (teleported out of this component's scope) */
.af-zone-switch .btn {
  font-size: 0.8rem;
}
/* a calendar opened on the page's body (teleport) : above the dialog it was opened from */
body > .dp__outer_menu_wrap,
body > .dp--menu-wrapper {
  z-index: 1070;
}
</style>
