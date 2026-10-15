import axios from 'axios';
import { useAppStore } from '@/stores/app';

const Profile = {
  /**
   * The signed-in user, from the server : the user of its token with its groups, which the
   * token does not carry (they made it too large for a request header, #1036). The groups are
   * kept on the store's profile, for the profile page and a form's __user__.
   *
   * Returns:
   *   Promise<object|undefined>: the user ; undefined when the call failed.
   */
  async load() {
    try {
      const result = await axios.get(`/api/v2/profile`);
      const user = result.data;
      const store = useAppStore();
      if (
        Array.isArray(user?.groups) &&
        store.profile &&
        store.profile.username === user.username &&
        store.profile.type === user.type
      ) {
        store.profile = { ...store.profile, groups: user.groups };
      }
      return user;
    } catch {
      // ignore... if the 401 is hit, the TokenStorage will redirect to the login page
    }
  },
  // how an account signs in, readable and with an icon : the profile page and the user menu
  loginType(t, type) {
    const types = {
      local: { label: t('profilePage.localAccount'), icon: 'house-user' },
      ldap: { label: 'LDAP', icon: 'address-book' },
      azuread: { label: 'Microsoft Entra ID', icon: 'fab,microsoft' },
      oidc: { label: 'OpenID Connect', icon: 'fab,openid' },
    };
    return types[type] || { label: type || '', icon: 'user' };
  },
};

export default Profile;
