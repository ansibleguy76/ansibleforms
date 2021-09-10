# Intro
Ansible forms is a lightweight node.js webapplication to generate userfriendly and pretty forms to kickoff ansible playbooks or awx (ansible tower) templates.

This project has 2 node applications
- A client app in vue
- A server app in express

The client app will dynamically build the forms (vue.js v2) for ansible/awx, based on a single json file (forms.json).
The server app (express.js) will cover authentication, background database connections and executing the ansible playbooks or awx templates.
# Documentation
[Go to the documentation wiki](/wiki "Wiki")

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
- Cascaded dropdowns
- Field dependencies
- Add icons
- Fieldfield validations
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
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -

# install nodejs
yum install -y nodejs

# create holder folder (can be custom)
mkdir /srv/ansible_forms
cd /srv/ansible_forms

# grab the code from github
yum install -y git
‌‌git init
git clone https://github.com/ansibleguy76/ansibleforms.git

# enter projects
cd ansible_forms
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
## import some sample data to for testing (optional)
```
mysql -u root -p -t< ./demo/demo_storage.sql > mysql_deployed.txt
mysql -u root -p -t< ./demo/demo_cmdb.sql > mysql_deployed.txt
```
## Project init
```
# install nodejs dependencies in both client and server subprojects
cd server
npm install
cd ..
cd client
npm install
cd ..

# prepare development environment variables
cd client
cp .env.example .env.development
cd ..
cd server
cp .env.example .env.development
cp ./demo/forms.json.example ./demo/forms.json
```
## modify the .env.development to your needs
- update forms path and log path
- set ansible path
- set awx connection details
- set mysql server connection details

## modify the forms.json to your needs
- add categories
- add roles
- add forms

### Run both server and client for development
```
cd client
npm run start

# this will kickoff nodemon and vue-cli-service serve, but using vue.config.js, it spins up a custom express server, wich runs our api's
```

### Run docker
```
# compile the client code and bundle in the server code
cd client
npm run bundle
cd ..
# this will build and bundle the client app in to the application
cd server
# install docker-ce !!!
docker build -t ansible_forms .
# note that the below is now binding a local path into app/persistent inside the containerized
# you can change the source path and choose any path you would like to mount, as long as the forms.json file is there
docker run -p 8000:8000 -d -t --mount type=bind,source="$(pwd)"/persistent,target=/app/persistent --env-file .env.docker ansible_forms
```
