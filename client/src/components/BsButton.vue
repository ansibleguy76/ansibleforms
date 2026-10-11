<script setup>
/******************************************************/
/*                                                    */
/*  Bootstrap Button Component                        */
/*                                                    */
/*  @props:                                           */
/*      colorClass: String - Color class              */
/*      isIconButton: Boolean - Is icon button        */
/*      icon: String - Icon name                      */
/*      cssClass: String - Custom css class           */
/*      spin: Boolean - Spin icon                     */
/*      iconToggle: String - Icon name for toggle     */
/*      toggle: Boolean - Toggle button               */
/*      cssClassToggle: String - Custom css class     */
/*                                                    */
/*  @emit:                                            */
/*      click: Event - Click event                    */
/*                                                    */
/******************************************************/

import { computed, useAttrs } from 'vue';

// INIT

const emit = defineEmits(['click']);

// PROPS

const props = defineProps({
  colorClass: {
    type: String,
    default: 'primary',
  },
  isIconButton: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: String,
    default: '',
  },
  cssClass: {
    type: String,
    default: '',
  },
  spin: {
    type: Boolean,
    default: false,
  },
  iconToggle: {
    type: String,
    default: '',
  },
  toggle: {
    type: Boolean,
    default: false,
  },
  cssClassToggle: {
    type: String,
    default: '',
  },
});

// COMPUTED

// a delete button (its trash icon) is red everywhere - its border, icon and words - whatever
// colour the page passed : one rule, so no Delete is ever blue beside its Save
const DELETE_ICONS = ['trash', 'trash-can', 'trash-alt'];
// a save button (its save icon) is orange everywhere, as the designer's - and grey while there is
// nothing to save (disabled, below) : one rule, so no page needs to pass a colour for its Save
const SAVE_ICONS = ['save', 'floppy-disk'];

// a disabled button is grey, whatever its colour : a faded blue still read as clickable (Delete
// next to a grey Save). `disabled` passes through as an attribute, so it is read from there.
const attrs = useAttrs();
const color = computed(() => {
  if (attrs.disabled !== undefined && attrs.disabled !== false) return 'secondary';
  if (DELETE_ICONS.includes(props.icon)) return 'danger';
  if (SAVE_ICONS.includes(props.icon)) return 'orange';
  return props.colorClass;
});

const classes = computed(() => {
  if (props.cssClass && !props.toggle) {
    return `btn-outline-${color.value} ${props.cssClass}`;
  } else if (props.cssClassToggle && props.toggle) {
    return `btn-outline-${color.value} ${props.cssClassToggle}`;
  } else {
    return `btn-outline-${color.value}`;
  }
});
</script>
<template>
  <button type="button" class="btn" :class="classes" @click="emit('click', $event)">
    <span v-if="icon && !toggle" :class="{ 'me-1': !isIconButton }"><FaIcon :icon="icon" :spin="spin" /></span>
    <span v-if="iconToggle && toggle" :class="{ 'me-1': !isIconButton }"
      ><FaIcon :icon="iconToggle" :spin="spin"
    /></span>
    <span>
      <slot v-if="!toggle"></slot>
      <slot name="toggle" v-if="toggle"></slot>
    </span>
  </button>
</template>
