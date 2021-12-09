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
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
library.add(far,fas) // add all solid icons
Vue.component('font-awesome-icon', FontAwesomeIcon)
// parse scss, including bulma
import "./../public/assets/main.scss"

// this is the token refresh control
// if we get a 401 error, we should try to refresh the tokens first and and have second attempt
axios.interceptors.response.use( (response) => {
  // Return a successful response back to the calling service
  return response;
}, (error) => {
  // Return any error which is not due to authentication back to the calling service
  if (error.response.status !== 401) {
    return new Promise((resolve, reject) => {
      reject(error);
    });
  }else{
    // Logout user if token refresh didn't work or user is disabled
    if (error.config.url == '/api/v1/token' || error.response.message == 'Account is disabled.') {
      // temp vue to have toast
      const vm = new Vue({})
      var message = "Unauthorized.  Access denied."
      if(error.response.data && error.response.data.message){
        message += "\r\n" + error.response.data.message
      }
      vm.$toast.warning(message)
      // clear our tokens from browser and push to login
      TokenStorage.clear();
      router.push({ name: 'Login' }).catch(err => {});

      return new Promise((resolve, reject) => {
        reject(error);
      });
    }

    // Try request again with new token
    console.log("Trying to refresh tokens")
    try{
      return TokenStorage.getNewToken()
        .then((token) => {
          // console.log("Refresh done")
            console.log("Retrying previous call with new tokens")
            // New request with new token
            const config = error.config;
            config.headers['Authorization'] = `Bearer ${token}`;

            return new Promise((resolve, reject) => {
              axios.request(config).then(response => {
                if(response.error){
                  Promise.reject(error);
                  reject(error);
                  router.push({ name: 'Login' }).catch(err => {});
                }else{
                  resolve(response);
                }
              }).catch((error) => {
                Promise.reject(error);
                reject(error);
                router.push({ name: 'Login' }).catch(err => {});
              })
            });
        })
        .catch((error) => {
          router.push({ name: 'Login' }).catch(err => {});
          Promise.reject(error);
        });
    }catch(err){
      console.log("Error")
    }
  }
});
Vue.config.productionTip = false
new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
Vue.component('jsonoutput', {})
