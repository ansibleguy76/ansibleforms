import axios from "axios";
import { useAppStore } from "@/stores/app";
import TokenStorage from "@/lib/TokenStorage";
import Navigate from "@/lib/Navigate";

var State = {
  loadProfile() {
    const store = useAppStore();
    var payload = TokenStorage.getPayload();
    store.profile = payload.user || {};
  },

  refreshAuthenticated() {
    const store = useAppStore();
    store.authenticated = TokenStorage.isAuthenticated();
    // console.log("checking if is admin")
    var payload = TokenStorage.getPayload();
    store.isAdmin = payload?.user?.roles?.includes("admin") || false;
  },

  async loadVersion() {
    const store = useAppStore();
    try {
      const result = await axios.get(`/api/v1/version`);
      if (result.data.status == "success") {
        store.version = result.data.message;
      }
    } catch (err) {
      // silent fail
    }
  },
  async refreshApprovals() {
    const store = useAppStore();
    const res = await axios.get(
      "/api/v2/job/approvals",
      TokenStorage.getAuthentication()
    );
    store.approvals = res?.data || 0;
  },

  // Check the schema and see what's missing.
  async checkDatabase() {
    // create timestamp to add to api call to prevent caching
    const timestamp = new Date().getTime();
    const store = useAppStore();
    try {
      const result = await axios.get(`/api/v2/schema?${timestamp}`);
      store.schemaData = result.data;
      return true;
    } catch (err) {
      let responseData = err?.response?.data;
      if (responseData && typeof responseData === "object") {
        if (responseData.error) {
          store.errorMessage = responseData.error;
        } else if (responseData.message) {
          store.errorMessage = responseData.message;
        }
        if (responseData.result) {
          store.schemaData = responseData.result.data;
        }
        return false;
      } else {
        store.errorMessage = "Failed to check AnsibleForms database schema\n\nUnknown error";
        throw new Error(store.errorMessage);
      }
    }
  }, 
  async init(router,route){
    State.refreshAuthenticated();
    if (!TokenStorage.isAuthenticated()) {
      console.log("Not authenticated, redirecting to login")
      Navigate.toLogin(router, route);
    } else {
      State.loadProfile();
      State.loadVersion();
      State.refreshApprovals();
      Navigate.toOrigin(router, route);
    }
  }
};

export default State;
