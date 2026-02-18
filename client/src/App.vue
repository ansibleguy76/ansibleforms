<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { Toaster } from "vue-sonner";

import TokenStorage from "@/lib/TokenStorage";
import Navigate from "@/lib/Navigate";
import { useAppStore } from "@/stores/app";
import State from "@/lib/State";
import Theme from "@/lib/Theme";

const route = useRoute();
const router = useRouter();
const isLoaded = ref(false)
// const theme = useTheme();

function registerAxiosInterceptor() {
  // this is the token refresh control
  // if we get a 401 error, we should try to refresh the tokens first and and have second attempt
  axios.interceptors.response.use((response) => {
    // Return a successful response back to the calling service
    return response;
  }, async (error) => {
    // Return any error which is not due to authentication back to the calling service

    if (error.response?.status !== 401) {
      throw error;
    } else {
      // Logout user if token refresh didn't work or user is disabled
      console.log("Axios 401 error occurred, we are not authorized")
      if (error?.config?.url == `/api/v1/token` || error?.response?.message == 'Account is disabled.' || error?.response?.message?.includes('No Access')) {
        console.log("The error is from token refresh or account is disabled or you have no access, no refresh possible")
        var message = "Unauthorized.  Access denied."
        if (error?.response?.data?.message) {
          message += "\r\n" + error.response.data.message
        }
        // clear token storage and redirect to login
        TokenStorage.clear();
        Navigate.toLogin(router, route)
        // throw new error back to axios, stop processing
        throw new Error(message)
      }

      // Try request again with new token
      try {
        const token = await TokenStorage.getNewToken()
        if (!token) {
          // No token was returned, this means the user is not authenticated
          // Silently redirect to login without spamming errors
          TokenStorage.clear();
          Navigate.toLogin(router, route)
          // Return a rejected promise to stop axios processing, but suppress the error message
          return Promise.reject({ __silent__: true });
        }
        console.log("Refresh done")
        console.log("Retrying previous call with new tokens")
        // New request with new token
        const config = error.config;
        config.headers['Authorization'] = `Bearer ${token}`;

        const retryResponse = await axios.request(config);
        if (retryResponse.error) {
          // The response itself contains an error, throw it
          throw retryResponse.error
        } else {
          // finally, the refresh worked and the response retried was successful
          return retryResponse
        }
      } catch (e) {
        // rethrow it.  It will likely be a new 401 error, not authorized to refresh, it will be caught by this interceptor in a second run
        // in all other cases, something was wrong with the token refresh
        throw e
      }
    }
  });
}

async function checkDatabase() {
  console.log("Checking database");
  var result;
  try{
    result = await State.checkDatabase();
  }catch(err){
    console.log(err)
    Navigate.toError(router);
    return;
  }
  if(result){
    await login();
  }else{
    Navigate.toSchema(router);
  }  
  isLoaded.value = true;
}

async function login() {
  console.log("login from app");
  await State.init(router,route)
}
 
onMounted(async () => {
  console.log("App is mounted");
  Theme.load()
  console.log("Theme is loaded")
  await router.isReady()
  registerAxiosInterceptor() // setup token refresh, an axios interceptor
  console.log("Router is ready")
  await checkDatabase();
  console.log("Database check complete")

});

</script>


<template>
  <Toaster position="bottom-right" :duration="5000" :close-button="true" rich-colors />
  <router-view v-if="isLoaded" />
  <div v-else class="d-flex justify-content-center align-items-center vh-100">
    <div class="text-center">
      <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading...</p>
    </div>
  </div>
</template>
<style>

</style>