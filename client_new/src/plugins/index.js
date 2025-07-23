/**
 * plugins/index.js
 *
 * Automatically included in `./src/main.js`
 */

// Plugins
// import vuetify from './vuetify'
import pinia from '@/stores'
import router from '@/router'
import Toast from "vue-toastification";
import VueVirtualScroller from 'vue-virtual-scroller'
import {VueShowdownPlugin} from 'vue-showdown'
import Popper from "vue3-popper";
import clickOutside from "@/directives/clickOutside"; 
import VueHighlightJS from "@/lib/Highlight.js";
import VueJsonPretty from 'vue-json-pretty'
import VueDatePicker from '@vuepic/vue-datepicker';

// Import our custom CSS
import '@/styles/settings.scss'
// Import all of Bootstrap's JS
import "bootstrap"

// Import the CSS for datepicker
import '@vuepic/vue-datepicker/dist/main.css'

// Import the css for vue json pretty
import 'vue-json-pretty/lib/styles.css'

// Import the CSS or use your own!
import "vue-toastification/dist/index.css";
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// font awesome global
import { library} from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { fas } from '@fortawesome/free-solid-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { faBrightness,faAzure,faOpenId,faAnsibleForms,faAnsible } from "./icons"

library.add(faBrightness, faAzure, faOpenId, faAnsibleForms, faAnsible)
library.add(fas, far, fab)

export function registerPlugins (app) {
  app
    // .use(vuetify)
    .use(router)
    .use(pinia)
    .use(VueVirtualScroller)
    .use(Toast, {
      position: "bottom-right",
      timeout: 5000,
      closeOnClick: true,
      pauseOnFocusLoss: false,
      pauseOnHover: true,
      draggable: true,
      draggablePercent: 0.6,
      showCloseButtonOnHover: false,
      hideProgressBar: false,
      closeButton: "button",
      icon: true,
      rtl: false,
    })
    .use(VueShowdownPlugin)
    .use(VueHighlightJS)
    .component("font-awesome-icon", FontAwesomeIcon)
    .component("popper", Popper)
    .component("VueJsonPretty", VueJsonPretty)
    .component("VueDatePicker", VueDatePicker)
    .directive('click-outside', clickOutside)
  
}
