import Vue from 'vue'
import Toast from "vue-toastification";
// Import the CSS or use your own!
import "vue-toastification/dist/index.css";
import App from './App.vue'
import router from "./router"
import TokenStorage from "./lib/TokenStorage"
import axios from "axios"

axios.interceptors.response.use( (response) => {
  // Return a successful response back to the calling service
  return response;
}, (error) => {
  // console.log("Interceptors is working : " + error.response.status)
  // Return any error which is not due to authentication back to the calling service
  if (error.response.status !== 401) {
    return new Promise((resolve, reject) => {
      reject(error);
    });
  }else{
    // Logout user if token refresh didn't work or user is disabled
    if (error.config.url == '/api/v1/token' || error.response.message == 'Account is disabled.') {
      this.$toast.warning("Unauthorized.  Access denied.")
      TokenStorage.clear();
      router.push({ name: 'Login' }).catch(err => {});

      return new Promise((resolve, reject) => {
        reject(error);
      });
    }

    // Try request again with new token
    console.log("Trying to refresh")
    try{
      return TokenStorage.getNewToken()
        .then((token) => {
          // console.log("Refresh done")
          console.log("Retrying axios")
          // New request with new token
          const config = error.config;
          config.headers['Authorization'] = `Bearer ${token}`;

          return new Promise((resolve, reject) => {
            axios.request(config).then(response => {
              resolve(response);
            }).catch((error) => {
              reject(error);
            })
          });

        })
        .catch((error) => {
          if(this.$toast){
            this.$toast.warning("Unauthorized.  Session timeout.")
          }
          router.push({ name: 'Login' }).catch(err => {});
          Promise.reject(error);
        });
    }catch(err){
      console.log("Error")
    }
  }



});
Vue.config.productionTip = false
import { POSITION } from "vue-toastification";
const options = {
    // You can set your default options here
    position:POSITION.BOTTOM_RIGHT
};
Vue.use(Toast,options)
new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
  Vue.component('jsonoutput', {})
