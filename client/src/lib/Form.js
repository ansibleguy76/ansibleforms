import axios from 'axios';
import i18n from '@/plugins/i18n';

// the error's opening line in the user's language (lib files have no component, so the global
// i18n instance), the server's own message below it
const t = (key, params) => i18n.global.t(key, params);

const Form = {
  async loadAll() {
    try {
      const result = await axios.get(`/api/v2/config?timestamp=${new Date().getTime()}`);
      return result.data;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.formsLoadFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },

  async load(name) {
    try {
      const result = await axios.get(
        `/api/v2/config/form?name=${encodeURIComponent(name)}&timestamp=${new Date().getTime()}`,
      );
      return result.data;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.formLoadFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },

  async list() {
    try {
      const result = await axios.get(`/api/v2/config/formlist?timestamp=${new Date().getTime()}`);
      return result.data;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.formListLoadFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },

  async save(forms) {
    try {
      await axios.post(`/api/v2/config`, { forms });
      return true;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.formsSaveFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },
  async validate(forms) {
    try {
      await axios.post(`/api/v2/config/check`, { forms });
      return true;
    } catch (err) {
      if (err.response?.status == 401) {
        throw new Error(err.message, { cause: err });
      }
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      const errorMessage = details ? `${error}\n\n${details}` : error;
      throw new Error(`${t('errors.formsValidateFailed')}\n\n${errorMessage}`, { cause: err });
    }
  },
};

export default Form;
