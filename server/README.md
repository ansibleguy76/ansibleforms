# Ansible Forms server

## Install dependencies
```
npm install
```
## Start in production from the CLI
This will run the server code in production environment.  
**Make sure you build the client app first** !  See the main readme
Make sure all environment variables are set or this will fail.
```
npm run start
```
## Start in development from the CLI
This will run the server code in development environment.  
**Make sure you build the client app first** !  See the main readme
Make sure all environment variables are set or this will fail.
```
npm run dev
```
## Start in production with PM2 (prefered)
This will run the server code in production environment with a decent process manager. (https://pm2.keymetrics.io/)
**Make sure you build the client app first** !  See the main readme
Make sure all environment variables are set or this will fail.
```
npm install -g pm2
npm run build
cp .env.example ./dist/.env.production
cd dist
pm2 start ecosystem.config.js --env production
```
