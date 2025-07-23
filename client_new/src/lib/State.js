import axios from "axios";
import { useAppStore } from "@/stores/app";
import TokenStorage from "@/lib/TokenStorage";

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
    const res = await axios.get('/api/v2/job/approvals',TokenStorage.getAuthentication());
    store.approvals = res?.data || 0;
  }  

};

export default State;
