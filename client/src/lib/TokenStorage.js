import axios from 'axios';

// the refresh in flight in this tab, which every request refused for an expired token waits for
let refreshing = null;

var TokenStorage = {
  isAuthenticated() {
    return TokenStorage.getToken() !== null;
  },

  getAuthentication() {
    return {
      headers: { Authorization: 'Bearer ' + this.getToken() },
    };
  },
  getAuthenticationMultipart() {
    return {
      headers: {
        Authorization: 'Bearer ' + this.getToken(),
        'Content-Type': 'multipart/form-data',
      },
    };
  },

  getPayload() {
    return this.decode(this.getToken());
  },

  /**
   * The payload of a JWT, unverified : what the browser may read of its own tokens (the user,
   * the expiry). The one decoder of the client.
   *
   * Args:
   *   token (string): the token.
   *
   * Returns:
   *   object: its payload, {} when it is no JWT.
   */
  decode(token) {
    var base64Url;
    var base64;
    var jsonPayload;
    try {
      base64Url = String(token).split('.')[1];
      base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      return {};
    }
  },
  /**
   * A fresh access token, after its expiry. When it expires a page has several requests in
   * flight, and the other tabs share the tokens : each used to refresh on its own with the same
   * single-use refresh token, the first won and the others were refused, and a refused one
   * cleared the tokens the winner had just stored, signing the user out (#1062). Now one refresh
   * runs at a time, across the tabs, and a request that failed with a token already replaced
   * takes the new one instead of refreshing again.
   *
   * Args:
   *   failedToken (string): the access token the refused request was sent with, if known.
   *
   * Returns:
   *   string: the new access token, null when the session cannot be refreshed.
   */
  async getNewToken(failedToken) {
    const current = this.getToken();
    if (failedToken && current && current !== failedToken) return current;
    if (!refreshing) {
      refreshing = this.refreshOnce().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  },

  // one refresh at a time, across the tabs of this browser where it can tell them
  refreshOnce() {
    const startedWith = this.getRefreshToken();
    const run = () => this.refresh(startedWith);
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request('ansibleforms-token-refresh', run);
    }
    return run();
  },

  async refresh(startedWith) {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      console.log('No refresh token found, cannot get new token');
      return null;
    }
    // another tab refreshed while this one waited for the lock
    if (startedWith && refreshToken !== startedWith) return this.getToken();

    console.log('Getting new token from server...');
    try {
      // __tokenRefresh : the 401 interceptor leaves this request's errors to the catch below
      const tokenResponse = await axios.post(`/api/v2/token`, { refreshtoken: refreshToken }, { __tokenRefresh: true });
      this.storeToken(tokenResponse.data.token);
      this.storeRefreshToken(tokenResponse.data.refreshtoken);
      return tokenResponse.data.token;
    } catch (err) {
      console.log('Getting token failed:', err.response?.data?.error || err.message);
      // a concurrent refresh, in a tab the lock could not reach, replaced the token first : the
      // server says so with a 409 for a few seconds, and its tokens land here shortly
      if (err.response?.status === 409) return this.waitForReplacement(refreshToken);
      return this.getRefreshToken() !== refreshToken ? this.getToken() : null;
    }
  },

  async waitForReplacement(refreshToken, timeout = 5000) {
    for (let waited = 0; waited < timeout; waited += 250) {
      if (this.getRefreshToken() !== refreshToken) return this.getToken();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (this.getRefreshToken() !== refreshToken) return this.getToken();
    // nothing came : the refresh that took it may have failed and given it back, so one more try
    try {
      const tokenResponse = await axios.post(`/api/v2/token`, { refreshtoken: refreshToken }, { __tokenRefresh: true });
      this.storeToken(tokenResponse.data.token);
      this.storeRefreshToken(tokenResponse.data.refreshtoken);
      return tokenResponse.data.token;
    } catch {
      return this.getRefreshToken() !== refreshToken ? this.getToken() : null;
    }
  },

  storeToken(token) {
    // console.log(`Storing token ${token}`);
    localStorage.setItem('token', token);
  },

  storeRefreshToken(refreshToken) {
    // console.log(`Storing refresh token ${refreshToken}`);
    localStorage.setItem('refreshtoken', refreshToken);
  },

  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshtoken');
  },

  getRefreshToken() {
    return localStorage.getItem('refreshtoken');
  },

  getToken() {
    return localStorage.getItem('token');
  },
};

export default TokenStorage;
