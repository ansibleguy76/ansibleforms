import axios from 'axios';
import i18n from '@/plugins/i18n';

// the error's opening line in the user's language (lib files have no component, so the global
// i18n instance), the server's own message below it
const t = (key, params) => i18n.global.t(key, params);

// Helper to extract API v2 error shape { error: message }
function extractError(err) {
  // Axios error response
  const data = err?.response?.data;
  if (data?.error) return data.error;
  if (typeof data === 'string') return data;
  return err.message || t('errors.unknownError');
}

const Lock = {
  // GET lock status (API v2 preferred). Returns pure object on success, throws on error.
  async get() {
    const res = await axios.get(`/api/v2/lock`);
    // v2 returns the object directly from RestResult.single
    return res.data; // { lock, match, free } OR { free: true }
  },
  async set() {
    try {
      const res = await axios.post(`/api/v2/lock`, {});
      return res.data; // { message: 'Lock added' }
    } catch (err) {
      throw new Error(t('errors.lockSetFailed', { error: extractError(err) }), { cause: err });
    }
  },
  async release() {
    try {
      const res = await axios.delete(`/api/v2/lock`);
      return res.data; // { message: 'Lock deleted' } or { message: 'Lock not present', deleted:false }
    } catch (err) {
      throw new Error(t('errors.lockReleaseFailed', { error: extractError(err) }), { cause: err });
    }
  },
  // an admin releases somebody else's lock (the server refuses anyone else)
  async forceRelease() {
    try {
      const res = await axios.delete(`/api/v2/lock`, { params: { force: true } });
      return res.data;
    } catch (err) {
      throw new Error(t('errors.lockReleaseFailed', { error: extractError(err) }), { cause: err });
    }
  },
};

export default Lock;
