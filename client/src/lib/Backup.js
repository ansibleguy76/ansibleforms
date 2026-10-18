import axios from 'axios';
import i18n from '@/plugins/i18n';

// the error's opening line in the user's language (lib files have no component, so the global
// i18n instance), the server's own message below it
const t = (key, params) => i18n.global.t(key, params);

const Backup = {
  async load() {
    try {
      const result = await axios.get(`/api/v2/config/backups?timestamp=${new Date().getTime()}`);
      return result.data;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.backupsLoadFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },
  async restore(backupName, backupBeforeRestore) {
    try {
      await axios.post(`/api/v2/config/restore/${backupName}?backupBeforeRestore=${backupBeforeRestore}`, {});
      return true;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.backupRestoreFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },
};

export default Backup;
