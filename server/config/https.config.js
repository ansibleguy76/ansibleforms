module.exports = {
  https: (process.env.HTTPS=="1"),
  httpsKey:JSON.parse(`"${process.env.HTTPS_KEY}"`),
  httpsCert:JSON.parse(`"${process.env.HTTPS_CERT}"`)
};
