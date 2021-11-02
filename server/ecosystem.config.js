require('dotenv').config({ path: `.env.production` })
module.exports = {
  apps: [{
    script: 'index.js',
    name: 'ansibleforms',
    env_production: {
       NODE_ENV: "production"
    },
    watch: '.'
  }]
};
