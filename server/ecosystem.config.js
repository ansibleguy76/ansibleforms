module.exports = {
  apps: [{
    script: 'index.js',
    name: 'ansibleforms',
    env_development: {
       NODE_ENV: "development"
    },
    env_production: {
       NODE_ENV: "production",
       FORCE_DOTENV: 1
    }
  }]
};
