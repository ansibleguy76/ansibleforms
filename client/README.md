# Ansible Forms client

## Install dependencies
```
npm install
```
## Start in development
This will spin up the server code (using vue.config.js) and run both server and client code with nodemon.
```
npm run start
```
## Build locally
This will compile the vue code to the ./dist folder
```
npm run build
```
## Bundle into server code
This will build and copy the dist folder to the server folder.  You can then run 'npm run start' in the server folder.
```
npm run bundle
```
