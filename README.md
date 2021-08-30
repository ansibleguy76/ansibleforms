# Ansible Express Vue projects

## Intro
This project has 2 apps
- A client app in vue
- A server app in express

The client app will dynamically build forms, using the forms.json file.
The client has following fields
- input
  - text
  - number
  - password
  - check
  - radio
  - ... any html input type in fact
- select
  - enum : manual dropdown
  - query : query dropdown (using sql statement)
    Query can contain a placeholder with another field $('fieldname')
- expression
  allows to pass a javascript expression
  Expression can contain a placeholder with another field $('fieldname')

Capabilities
- group fields
- categories
- cascading dropdowns (using $(field) replacements)
- dependencies (to show/hide fields)
- add icon to field (font-awesome)
- validations
  - regex (with custom description)
  - minLength
  - maxLength
  - minValue
  - maxValue
  - required
  - sameAs (for password verify for example)
- helpmessage
- label
- placeholder
- model : allow to push a value in an object-like format (ex. volume.export_policy.name)

The server app will serve as an api for the query-fields and for invoking the ansible playbook or awx template.
TODO : implement swagger ui

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
git clone https://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@github.com/CXO-Automation/ansible_express_vuejs.git

# enter projects
cd ansible_express_vuejs
```

### Install a mysql for query demo and local user authentication
```
cd ..
yum install -y mariadb-server
systemctl start mariadb
systemctl enable mariadb
mysql_secure_installation
* the above will be interactive, but choose Netapp12 as root password *
# import some sample data to start with
mysql -u root -p -t< ./demo_ansible_express_vuejs.sql > mysql_deployed.txt

# create a user for remote access / ideally with root access if you want to auto deploy the authentication Schema
# or create another similar user... sample code below.
mysql -u root -p
# create root user / write user.  Will be used to create new users and schema
# if you create the schema yourself, you could limit this user to the authentication schema
CREATE USER 'root'@'%' IDENTIFIED BY 'Netapp12';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

### Project init
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

# modify the .env.development to your needs
- update forms path and log path
- set ansible path
- set awx connection details
- set mysql server connection details

```

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
docker run -p 8000:8000 -d -t --mount type=bind,source="$(pwd)"/persistent,target=/app/persistent --env-file .env.docker karelverhelst/ansibleforms:latest
```
