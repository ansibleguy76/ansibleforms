import axios from "axios";

var TokenStorage = {
  isAuthenticated() {
    return TokenStorage.getToken() !== null;
  },

  getAuthentication() {
    return {
      headers: { Authorization: "Bearer " + this.getToken() },
    };
  },
  getAuthenticationMultipart() {
    return {
      headers: {
        Authorization: "Bearer " + this.getToken(),
        "Content-Type": "multipart/form-data",
      },
    };
  },

  getPayload() {
    var base64Url = "";
    var base64 = "";
    var jsonPayload = "";
    try {
      base64Url = this.getToken().split(".")[1];
      base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      return {};
    }
  },
  async getNewToken() {
    var ref = this;
    console.log("Getting new token from server...");
    
    let tokenResponse;
    const refreshToken= this.getRefreshToken();

    if (!refreshToken) {
      console.log("No refresh token found, cannot get new token");
      return null;
    }
    tokenResponse = await axios.post(`/api/v1/token`, {
      refreshtoken: refreshToken,
    });

    if (tokenResponse.error) {
      console.log("Getting token failed");
      throw new Error(tokenResponse.message);
    } else {
      this.storeToken(tokenResponse.data.token);
      this.storeRefreshToken(tokenResponse.data.refreshtoken);
      return tokenResponse.data.token;
    }
  },

  storeToken(token) {
    // console.log(`Storing token ${token}`);
    localStorage.setItem("token", token);
  },

  storeRefreshToken(refreshToken) {
    // console.log(`Storing refresh token ${refreshToken}`);
    localStorage.setItem("refreshtoken", refreshToken);
  },

  clear() {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshtoken");
  },

  getRefreshToken() {
    return localStorage.getItem("refreshtoken");
  },

  getToken() {
    return localStorage.getItem("token");
  },
};

export default TokenStorage;
