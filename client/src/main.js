import Vue from 'vue'
import Toast from "vue-toastification";
// Import the CSS or use your own!
import "./../public/assets/toast.scss";
import { POSITION } from "vue-toastification";
const options = {
    // You can set your default options here
    position:POSITION.BOTTOM_RIGHT
};
Vue.use(Toast,options)
import App from './App.vue'
import router from "./router"
import TokenStorage from "./lib/TokenStorage"
import axios from "axios"
// add font awesome
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
library.add(far,fas,fab) // add all solid icons
Vue.component('font-awesome-icon', FontAwesomeIcon)
// parse scss, including bulma
import "./../public/assets/main.scss"

// this is the token refresh control
// if we get a 401 error, we should try to refresh the tokens first and and have second attempt
axios.interceptors.response.use( (response) => {
  // Return a successful response back to the calling service
  return response;
}, async (error) => {
  // Return any error which is not due to authentication back to the calling service
  if (error.response?.status !== 401) {
    throw error;
  }else{
    console.log("Unauthorized detected")
    console.log("Error : " + error)

    var originConfig = error?.config || {};
    const originUrl = error?.config?.url || "";
    const originResponseMessage = error?.response?.message || "";
    const originResponseErrorMessage = error?.response?.data?.error || "";

    try{
      if(!originConfig || !originUrl){
        throw new Error("Unauthorized detected, redirecting to login (no origin config or url)")
      }

      console.log("Origin url : " + originUrl)
      console.log("Origin response message : " + originResponseMessage)
      console.log("Origin response error message : " + originResponseErrorMessage)

      // Logout user if token refresh didn't work or user is disabled or there was no access to the resource, not token related
      if (originUrl == `/api/v1/token` || originResponseMessage == 'Account is disabled.' || originResponseMessage.includes('No Access')) {

        // clear our tokens from browser and push to login
        TokenStorage.clear();
        router.push({ name: 'Login', query: {from: this?.$route?.fullPath || ""} }).catch(err => {});        
        throw new Error("Unauthorized detected, redirecting to login (no access)")
      }

      // Try request again with new token
      console.log("Trying to refresh tokens")
      const newToken = await TokenStorage.getNewToken();

      console.log("Retrying previous call with new tokens")
      // New request with new token
      originConfig.headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await axios.request(originConfig);
      if(retryResponse.error){
        throw retryResponse.error;
      }else{
        return retryResponse;
      }

    }catch(e){

      const vm = new Vue({})
      var message = "Unauthorized.  Access denied."
      if(originResponseMessage){
        message = [message,originResponseMessage,originResponseErrorMessage,e.message].join("\r\n")
      }
      vm.$toast.warning(message)

      throw e

    }
  }
});
Vue.config.productionTip = false
new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
Vue.component('jsonoutput', {})
