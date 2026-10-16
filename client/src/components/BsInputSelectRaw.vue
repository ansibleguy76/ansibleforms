<script setup>
/******************************************************************/
/*                                                                */
/*  Bootstrap Input Select component                              */
/*                                                                */
/*  @props:                                                       */
/*      placeholder: String                                       */
/*      readonly: Boolean                                         */
/*      style: String                                             */
/*      cssClass: String                                          */
/*      uid: String                                               */
/*      hasError: Boolean                                         */
/*      values: Array                                             */
/*      valueKey: String - values are objects                     */
/*      labelKey: String - values are object                      */
/*      disabled: Boolean                                         */
/*      empty: String - with nothing to choose (no value but an   */
/*         empty one), the dropdown disabled, saying this         */
/*                                                                */
/******************************************************************/

import { computed } from 'vue';

// MODEL

const model = defineModel();

// PROPS

const props = defineProps({
  placeholder: {
    type: String,
    default: '',
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  style: {
    type: String,
    default: '',
  },
  cssClass: {
    type: String,
    default: '',
  },
  uid: {
    type: String,
    default: '',
  },
  hasError: {
    type: Boolean,
    default: false,
  },
  values: {
    type: Array,
    default: () => [],
  },
  valueKey: {
    type: String,
    default: 'value',
  },
  labelKey: {
    type: String,
    default: 'label',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  empty: {
    type: String,
    default: '',
  },
});

// nothing to choose : no value but an empty one (the "none" a dropdown starts with)
const isEmpty = computed(() => !!props.empty && !props.values.some((v) => v?.[props.valueKey]));

// COMPUTED

const classes = computed(() => {
  let classList = ['form-select'];
  if (props.cssClass) {
    classList.push(props.cssClass);
  }
  if (props.hasError) {
    classList.push('is-invalid');
  }
  return classList.join(' ');
});
</script>
<template>
  <!-- nothing to choose : disabled, the one option saying so -->
  <select v-if="isEmpty" :id="uid" :style="style" :class="classes" class="af-select-empty" disabled>
    <option value="" selected>{{ empty }}</option>
  </select>
  <select
    v-else
    :readonly="readonly"
    :disabled="disabled"
    :id="uid"
    :style="style"
    :class="classes"
    :placeholder="placeholder"
    v-model="model"
  >
    <option v-for="value in values" :key="value[valueKey]" :value="value[valueKey]">{{ value[labelKey] }}</option>
  </select>
</template>
