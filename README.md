# Intro
Ansible forms is a lightweight node.js webapplication to generate userfriendly and pretty forms to kickoff ansible playbooks or awx (ansible tower) templates.

This project has 2 node applications
- A client app in vue
- A server app in express

The client app will dynamically build the forms (vue.js v2) for ansible/awx, based on a single json file (forms.json).
The server app (express.js) will cover authentication, background database connections and executing the ansible playbooks or awx templates.
# Documentation
[Go to the documentation wiki](https://github.com/ansibleguy76/ansibleforms/wiki "Wiki")

# Requirements
- node.js capable server or container
- MySql/MariaDb server to cover local authentication

# Technologies
The webapplication is based on a
- Frontend
  - vue (core)
  - vue-router (navigation)
  - axios (api calls)
  - vuelidate (form validation)
  - vue-toastification (alerting)
  - vue-json-pretty (json formatter)
  - bulma.io (responsive css framework)
  - FontAwesome (icon font library)
- Backend
  - express (core)
  - winston (logging)
  - axios (api calls)
  - bcrypt (password hashing)
  - cheerio (html parser)
  - passport (authentication/authorization)
  - mysql (mysql connection)
  - connect-history-api-fallback (history api)
  - ajv (json schema validation)
- Database
  - MySql/MariaDb
# Capabilities
- Categorize forms
- Role based access
- Cascaded dropdowns (sql)
- Expressions (javascript)
- Field dependencies
- Add icons
- Field validations
- Group fields
- Nested output modelling (control the form output in a multilevel object)
- Json web tokens authorization (jwt) (access & refresh)
- Environment variables
- Ldap & local authentication
# How to install
## Project download
```
# remove nodejs if needed
yum remove -y nodejs
# get repro
yum install -y gcc-c++ make
curl -sL https://rpm.nodesource.com/setup_14.x | sudo -E bash -

# install nodejs
yum install -y nodejs

# create holder folder (can be custom)
mkdir /srv/apps
cd /srv/apps

# grab the code from github
yum install -y git
‌‌git init
git clone https://github.com/ansibleguy76/ansibleforms.git

# enter the app project
cd ansibleforms

# verify that you have 2 subfolder
```
## Install MySql (or skip to use exising one)
```
cd ..
yum install -y mariadb-server
systemctl start mariadb
systemctl enable mariadb
mysql_secure_installation
* the above will be interactive, but choose AnsibleForms as root password *
# create a user for remote access
mysql -u root -p
CREATE USER 'root'@'%' IDENTIFIED BY 'AnsibleForms';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;
```
Note : You can create multiple users and lock down the database as you please, however if the webapplication cannot find the authentication database, it will try to create it.  So you might want to give enough privileges.
## Import some sample data for testing (optional)
```
mysql -u root -p -t< ./demo/demo_cmdb.sql > mysql_deployed.txt
```
## Project init
First we install all nodejs dependencies for both client & server
```
cd server
npm install

cd ..
cd client
npm install

cd ..
```
Second we prep our environment variables.  An environment variable file contains the configuration of this application, such as http(s) settings, ldap settings, database connections, log settings, ...
This application comes with an `.env.example` file that you must copy to `.env.development` or `.env.production` and adjust to your needs.  You can maintain both development and production file to test if you have different dev & prod environments and settings.
```
cd client
cp .env.example .env.development

cd ..
cd server
cp .env.example .env.development
cp ./persistent/forms.json.example ./persistent/forms.json
```
## Modify the .env.development (or .env.production) to your needs
- enable https if needed and set the certificate
- update forms path and log path
- set ansible path
- set awx connection details
- set mysql server connection details
## Modify the forms.json to your needs
The `forms.json` file describes all your forms in a json format.  It must be available in the server application.  By default it's under `/server/persistent`, but if you choose to run this application containerized, then the file is best fit on a mountpath or persistent volume.  So set the location of the `forms.json` file correctly in the environment file.  In the file, make the proper changes, refer to the wiki documentation for all details.

- add categories
- add roles
- add forms

# How to run
## In development
First of all one must understand that this application has both a client and server side.
The client side is build with vue2 and compiles in a single html, css & js script file.
The server side is build with express (must also be compiled) and runs the api's and database connections.

All behavior and how things are started using the `npm run command` is in the `package.json` file (one for client and one for server).  There are several methods like 'build, bundle, start, ...' depending on what you want to do.
### Run both server and client for development
When you test a vue2 application (client application), it typically spins up a temporary Express webserver, which is useless if you also have a server application, which would not but running in this case.  Therefor we have added a `vue.config.js` file which also starts our server code in that temp express server.  Now we start our client app in development, along with the server code.  We also use nodemon to auto rebuild if the code changes.
```
cd client
npm run start
```
### Run compiled in development
If are done testing, you can compile the client code and have it embedded into the server code.  And then spin up the server application.  the command `npm run bundle` will compile the client code and copy it under `/views` in the server application.  You can then start the server application with `npm run dev`, and as you will see in the `package.json`, it will build, copy the environment file and start the server application in dev mode.

First we compile the client code, and bundle it in the server code
```
cd client
npm run bundle
```
Then we run the server code in development mode.  `npm run dev` will also copy the `.env.development` file into the `./dist` folder, so make sure it's there !
```
cd ..
cd server
npm run dev
```
## Run in production
### Run with PM2
Running the application in the commandline, makes it fragile when something goes wrong.  We need an environment where the nodejs application can run when logged of, where it can be monitored and even restarted in case of a crash.  That's were PM2 comes in. (https://pm2.keymetrics.io/)
```
npm install -g pm2
```
We again compile the client code and bundle it in the server code
```
cd client
npm run bundle
```
We now compile the server code, but don't start it.
```
cd ..
cd server
npm run build
```
Then we copy a production ready environment file. (change it to fit your production environment)
```
cp .env.example ./dist/.env.production
```
Then we start it in PM2.  
```
cd dist
pm2 start ecosystem.config.js --env production
```
### Run with docker
If you want to containerize the application, this code comes with a Dockerfile holding the steps to build the image. (examine `Dockerfile`).

First compile the client code and bundle with server code
```
cd client
npm run bundle
```
Then install docker-ce (https://docs.docker.com/engine/install/)
Then build the docker image (it will use `Dockerfile`)
```
cd ..
cd server
docker build -t ansible_forms .
```
We now start the docker container.
Note that we have deployed the solution in the `./app` folder inside the docker.  So make sure that `forms.json` is reachable from within the docker image either using a mount path or persistent volume.
Make sure you have `.env.docker` file that contains all environment variables.  You can copy a sample from `.env.docker.example`
```
docker run -p 8443:8443 -d -t --mount type=bind,source="$(pwd)"/persistent,target=/app/persistent --env-file .env.docker ansible_forms
```
# First time run
## Create authentication database
The first you surf to the webapplication, it will ask you if it should create the authentication schema.  
## Admin user
The default admin user is :
- username : admin
- password : AnsibleForms!123
