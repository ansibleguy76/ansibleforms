module.exports = {
  secret: process.env.ACCESS_TOKEN_SECRET || "swsh23hjddnns",
  jwtExpiration: process.env.ACCESS_TOKEN_EXPIRATION || "5m",
  jwtRefreshExpiration: process.env.ACCESS_TOKEN_REFRESH_EXPIRATION || "24h",
  jwtStore: {},
  ldapErrorRegex:".*, data ([^,]*),.*",
  ldapErrors:{
    "52e":"Wrong password",
    "525":"User not found",
    "530":"Not permitted to logon at this time",
    "532":"Password expired",
    "533":"Account disabled",
    "701":"Account expired",
    "773":"User must reset password",
    "775":"Account locked"
  }
};
