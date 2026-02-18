<script setup>
import { ref, onMounted } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import TokenStorage from "@/lib/TokenStorage"; // work with tokens and local storage
import State from "@/lib/State"; // work with state
import Navigate from "@/lib/Navigate"; // navigate to routes
import { toast } from 'vue-sonner';
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import Theme from "@/lib/Theme";

// plugins

const route = useRoute();
const router = useRouter();

// Decode JWT payload without jwt.decode, install library, e.g. jwt-decode, instead?
function decodeJwtPayload(token) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  // Base64url -> Base64
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

  try {
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to decode JWT payload", e);
    return null;
  }
}

// vuelidate
const rules = {
   user: {
      username: {
         required
      },
      password: {
         required
      }
   }

}
// data
const user = ref({
   username: "",
   password: ""
});

const currentTheme = ref(Theme.load());
const loading = ref(false);
const azureAdEnabled = ref(false);
const azureGroupfilter = ref("");
const azureGraphUrl = ref("");
const oidcEnabled = ref(false);
const oidcGroupfilter = ref("");
const oidcIssuer = ref("");

// validation
const $v = useVuelidate(rules, { user });

// methods
function authAzureAd() {
   localStorage.setItem("authIssuer", "azuread");  // set cookie to azuread
   window.location.replace(`/api/v1/auth/azureadoauth2`) // redirect to azuread
}
function authOidc() {
   localStorage.setItem("authIssuer", "oidc");   // set cookie to oidc
   window.location.replace(`/api/v1/auth/oidc`) // redirect to oidc
}
function getGroupsAndLogin(token, url = `${azureGraphUrl.value}/v1.0/me/transitiveMemberOf`, type = 'azuread', allGroups = []) {
   if (type === 'azuread') {
      const config = {
         headers: {
            Authorization: `Bearer ${token}`
         }
      };

      axios.get(url, config)
         .then((res) => {
            const groups = res.data.value.filter(x => x.displayName).map(x => x.displayName);
            allGroups = allGroups.concat(groups);

            if (res.data['@odata.nextLink']) {
               // If there's a nextLink, make a recursive call to get the next page of data
               getGroupsAndLogin(token, res.data['@odata.nextLink'], type, allGroups);
            } else {
               // No more nextLink, you have all the groups
               tokenLogin(token, allGroups)
            }
         })
         .catch((err) => {
            toast.error("Failed to get group membership");
         });
   }
   else {
    // OIDC branch for now => specify type in the future?
    // decode JWT with helper instead of using undefined `jwt.decode`
    const payload = decodeJwtPayload(token);

    if (!payload) {
      toast.error("Failed to decode login token");
      return;
    }

    tokenLogin(token, payload.groups || [], 'oidc')
  }
}
function tokenLogin(token, allGroups, type = 'azuread') {
   var validRegex = true
   var regex
   const groupfilter = type === 'azuread' ? azureGroupfilter.value : oidcGroupfilter.value
   try {
      regex = new RegExp(groupfilter, 'g');
   } catch (e) {
      console.error("Identity Provider Group filter is not a valid regular expression")
      validRegex = false
   }
   if (validRegex && groupfilter) {
      allGroups = allGroups.filter(x => x.match(regex))
   }
   const loginProvider = type === 'azuread' ? 'azureadoauth2' : 'oidc'

   axios.post(`/api/v1/auth/${loginProvider}/login`, { token: token, groups: allGroups })
      .then((result) => {
         if (result.data.token) {
            processLogin(result.data)
         } else {
            toast.error("Identity Provider Login failed, no token found");
         }
      })
      .catch((err) => {
         console.log(err);
         toast.error("Identity Provider Login failed");
      });
}
function getSettings(token) {
   axios.get(`/api/v1/auth/settings`)
      .then((result) => {
         if (result.data?.status == 'success') {
            azureAdEnabled.value = !!result.data.data.output.azureAdEnabled
            azureGroupfilter.value = result.data.data.output.azureGroupfilter
            azureGraphUrl.value = result.data.data.output.azureGraphUrl

            oidcEnabled.value = !!result.data.data.output.oidcEnabled
            oidcGroupfilter.value = result.data.data.output.oidcGroupfilter
            oidcIssuer.value = result.data.data.output.oidcIssuer

            if (token && azureAdEnabled.value) {
               if (localStorage.getItem("authIssuer") == "azuread") // get cookie and see if we issued azuread
                  getGroupsAndLogin(token)
            }
            if (token && oidcEnabled.value) { // get cookie ans see if we issued oidc
               if (localStorage.getItem("authIssuer") == "oidc")
                  getGroupsAndLogin(token, `${oidcIssuer.value}/protocol/openid-connect/userinfo`, 'oidc')
            }
         } else {
            toast.error(result.data.data.error)
         }
      })
      .catch((err) => {
         toast.error(`Failed to get settings: ${err}`)
      })
}
function processLogin(data) {
   TokenStorage.storeToken(data.token)
   TokenStorage.storeRefreshToken(data.refreshtoken)

   if (!TokenStorage.isAuthenticated()) {
      // console.log("Not authenticated, redirecting to login")
      Navigate.toLogin(router,route)
   } else {
      // console.log("Authenticated")
      Navigate.toOrigin(router,route)
      State.refreshAuthenticated()
      State.loadProfile()
      // loadApprovals() // TODO - load approvals
   }
}
async function login() {
   localStorage.removeItem("authIssuer") // remove cookie, regular login
   if (!$v.value.user.$invalid) {
      console.log("Logging in")
      var basicAuth = 'Basic ' + btoa(`${user.value.username}:${user.value.password}`)
      var postconfig = {
         headers: { 'Authorization': basicAuth }
      }
      axios.post(`/api/v1/auth/login`, {}, postconfig)
         .then((result) => {
            if (result.data.token) {
               processLogin(result.data)
            } else {
               TokenStorage.clear()
               toast.error(result.data.message)
            }

         }).catch(function (error) {
            TokenStorage.clear()
         })
   } else {
      toast.error("Form is not valid")
      $v.value.user.$touch()
   }
}
onMounted(() => {

   // TODO => check database before all else

   if (route.query.token) {
      loading.value = true
      getSettings(route.query.token)
   } else {
      getSettings()
   }
   if (route.query.error) {
      toast.error(route.query.error)
   }
   State.loadVersion()
});
</script>

<template>

   <div class="d-flex align-items-center py-4 bg-body-tertiary login vh-100">
      <div class="dropdown position-fixed bottom-0 end-0 mb-3 me-3 bd-mode-toggle">
      <BsThemeSwitcher buttonClass="btn-bd-primary py-2" v-model="currentTheme" />
   </div>

   <div class="card form-signin w-100 m-auto">
      <div class="card-body">
         <h5 class="card-title">Please sign in</h5>
         <BsInput v-model="user.username" @keyup_enter="login()" label="Username" placeholder="Username" icon="user"
            :hasError="$v.user.username.$invalid && $v.user.username.$dirty" :errors="$v.user.username.$errors" />
         <BsInput v-model="user.password" @keyup_enter="login()" type="password" label="Password" placeholder="Password" icon="lock"
            :hasError="$v.user.password.$invalid && $v.user.username.$dirty" :errors="$v.user.password.$errors" />
         <button class="btn btn-primary w-100 py-2" @click="login()">Sign in</button>
         <div role="button" class="m-2 azure d-inline-block">
            <FaIcon icon="fac,azure" size="3x" @click="authAzureAd()" v-if="azureAdEnabled" />
         </div>
         <div role="button" class="m-2 openid d-inline-block">
            <FaIcon icon="fac,openid" size="3x" @click="authOidc()" v-if="oidcEnabled" />
         </div>
      </div>
   </div>   
  </div>





</template>


<style scoped>
.form-signin {
   max-width: 500px;
   padding: 1rem;
}

.azure {
   color: #0072c6;
}

.openid {
   color: #d07c1a;
}
[data-bs-theme="light"] {
    .login{
      background-image: url(/img/login_background_light.jpg) !important;
      background-size: cover;
    }
  }
  [data-bs-theme="dark"] {
    .login{
      background-image: url(/img/login_background_dark.jpg) !important;
      background-size: cover;
    }
  }
  [data-bs-theme="color"] {
    .login{
      background-image: url(/img/login_background_color.jpg) !important;
      background-size: cover;
    }
  }  
</style>