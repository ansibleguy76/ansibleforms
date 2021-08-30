import axios from 'axios';
import { Promise } from 'es6-promise';

var TokenStorage = {

  isAuthenticated() {
    return TokenStorage.getToken() !== null;
  },

  getAuthentication() {
    return {
      headers: { 'Authorization': 'Bearer ' + this.getToken() }
    };
  },
  getPayload(){
    var base64Url="";
    var base64="";
    var jsonPayload="";
    try{
      base64Url = this.getToken().split('.')[1];
      base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload)
    }catch(err){
      return {}
    }
  },
  getNewToken() {
    return new Promise((resolve, reject) => {
      try{
        axios
          .post('/api/v1/token', { refreshtoken: this.getRefreshToken() })
          .then(response => {

            this.storeToken(response.data.token);
            this.storeRefreshToken(response.data.refreshtoken);

            resolve(response.data.token);
          })
          .catch((error) => {
            reject(error);
          });
      }catch(err){
        console.log("Error")
      }

    });
  },

  storeToken(token) {
    localStorage.setItem("token", token);
  },

  storeRefreshToken(refreshToken) {
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
  }

};

export default TokenStorage
