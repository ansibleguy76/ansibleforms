<script setup>
/******************************************************************/
/*                                                                */
/*  Bootstrap Nav Link component                                  */
/*                                                                */
/*  @props:                                                       */
/*      link: Object - { link, title, icon, badge, indicator,     */
/*            also }                                              */
/*            also : other paths the link is active on (Forms on  */
/*            a form, /form)                                      */
/*            indicator : { icon, class, title } - a small icon   */
/*            on the link's icon, with its tooltip                */
/*            href, newTab : an instance's own link (Settings >   */
/*            Appearance > Links) - a site, or a page of the app  */
/*                                                                */
/******************************************************************/

import { computed } from 'vue';
import { useRoute } from 'vue-router';

// INIT

const route = useRoute();

// PROPS

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

// an own link to a page of the app (/forms/all) : the router's, unless it opens a new tab
const internal = computed(() => (props.link.href?.startsWith('/') ? props.link.href : null));

// on its page, a page below it, or a path it is also the link of (link.also)
const active = computed(() => {
  // an own link : active on its own page of the app only, never for another site
  if (props.link.href) return !!internal.value && route.path === props.link.href.split(/[?#]/)[0];
  const path = route.path;
  const { link, also = [] } = props.link;
  if (path == link || (path.includes(link) && link !== '/')) return true;
  return also.some((p) => path === p || path.startsWith(p + '/'));
});
</script>
<template>
  <li class="nav-item">
    <!-- an own link to a site, or to a page of the app in a new tab : a plain link -->
    <a
      v-if="link.href && (!internal || link.newTab)"
      :href="link.href"
      :target="link.newTab ? '_blank' : '_self'"
      :rel="link.newTab ? 'noopener noreferrer' : undefined"
      class="nav-link icon-link link-body-emphasis"
      :title="link.title"
    >
      <span class="af-nav-link-icon"><font-awesome-icon :icon="link.icon" /></span>
      <span class="af-nav-text">{{ link.title }}</span>
    </a>
    <router-link
      v-else
      :to="link.href || link.link"
      class="nav-link icon-link"
      :class="{ active, 'link-body-emphasis': !active }"
      :title="link.title"
    >
      <span class="af-nav-link-icon" :class="{ 'af-has-indicator': link.indicator }">
        <font-awesome-icon :icon="link.icon" />
        <!-- a small state icon on the link's icon (the designer lock), explained by its tooltip -->
        <span
          v-if="link.indicator"
          class="af-nav-indicator"
          :class="link.indicator.class"
          :title="link.indicator.title"
          role="img"
          :aria-label="link.indicator.title"
          ><font-awesome-icon :icon="link.indicator.icon"
        /></span>
      </span>
      <span class="af-nav-text">{{ link.title }}</span>
      <span v-if="link.badge && link.badge > 0" class="badge rounded-pill bg-danger ms-2 align-middle">{{
        link.badge
      }}</span>
    </router-link>
  </li>
</template>
<style scoped lang="scss">
// the link's icon carries the indicator on its top right corner, like the bell its count
.af-nav-link-icon {
  position: relative;
  display: inline-flex;
  // the indicator sticks out on the right : room for it before the link's title
  &.af-has-indicator {
    margin-right: 0.5em;
  }
}
.af-nav-indicator {
  position: absolute;
  top: -0.55em;
  right: -0.75em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3em;
  height: 1.3em;
  border-radius: 50%;
  font-size: 0.8em;
  color: #ffffff;
  // a ring in the header's color, so it stands out from the icon under it
  box-shadow: 0 0 0 2px var(--af-bg-navbar);
  svg {
    font-size: 0.85em !important;
    opacity: 1 !important;
  }
  // the user holds the lock themselves : green
  &.af-lock-mine {
    background-color: var(--bs-success);
  }
  // someone else holds it : red, the designer is not available
  &.af-lock-other {
    background-color: var(--bs-danger);
  }
}
</style>
