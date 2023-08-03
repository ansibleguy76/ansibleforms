---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Installation
description: How to install AnsibleForms

# Micro navigation
micro_nav: true

# Page navigation
page_nav:
    prev:
        content: Introduction
        url: '/introduction'
    next:
        content: Customization and Environment Variables
        url: '/customization'
---

AnsibleForms can be installed in a few ways.  

* **Native install** : You install everything manually, install all dependencies, build the code, start the code
* **Use Docker** : Use the pre-built docker image
  * **Single container** : Install MySql and spin-up the docker image with the correct environment variables
  * **Docker Compose** : [Download the docker-compose project](https://github.com/ansibleguy76/ansibleforms-docker) and use docker-compose to start both MySql and AnsibleForms
  * **Kubernetes** : [Download the docker-compose project](https://github.com/ansibleguy76/ansibleforms-docker) and use Kubernetes to start AnsibleForms

<div class="callout callout--info">
    <p><strong>Recommendation</strong> Out of experience, I recommend the use of the docker-image.  It has all (many) dependencies installed and can be setup very quickly.</p>
</div>


# Install using Docker-Compose

The recommended way to install AnsibleForms is using `Docker Compose`, which is the fastest way to start AnsibleForms with Docker.  However, if you are skilled with docker and/or Kubernetes, the [docker-compose (with Kubernetes sample)](https://github.com/ansibleguy76/ansibleforms-docker), together with the environment variables should get you started as well.

<div class="callout callout--danger">
    <p><strong>Note</strong> Using docker and docker-compose for the first time, requires some basic linux skills and some knowledge about containers</p>
    <p><a href="/doks-theme/assets/files/docker and ansibleforms.pdf">Download this document</a> to get you kick-started with containers and Docker</p>
</div>

## Prerequisites

* **Linux machine** : Any flavour should do, The need of CPU and memory is not very high, but, of course can grow if you start a lot of playbooks simultaniously
* **Github access** : The easiest way is to download or clone the docker-compose project on Github
* **Install Docker** : You need to have a container environment, and in this example we use Docker
* **Install Docker Compose** : To spin-up AnsibleForms and MySql with docker, using a few simple configuration-files, we need Docker Compose

<div class="callout callout--info">
    <p><strong>Note</strong> The steps below are also explained on Github.  
    <br><a class="btn btn-md" href="https://github.com/ansibleguy76/ansibleforms-docker">Read on Github</a></p>
</div>

<div class="callout callout--warning">
    <p><strong>Linux Flavour</strong> The examples below are for Redhat/CentOs, use apt-get or other package managers for your flavour of linux.</p>
</div>



## Choose a location to install

```bash
mkdir /srv/apps
cd /srv/apps
```

## Clone the docker-compose project

```bash
yum install -y git
‌‌git init
git clone https://github.com/ansibleguy76/ansibleforms-docker.git

cd ansibleforms-docker
```

## Set permissions

```bash
# write access will be needed on the datafolder
chmod -R 664 ./data
# the mysql init folder needs execute rights 
chmod -R +x ./data/mysql/init/
```

## Install Docker

```bash
yum install -y docker-ce docker-ce-cli containerd.io docker-compose

# the below is to ensure dns works properly inside the dockerimages
mkdir -p /etc/docker
echo "{\"dns-opts\":[\"ndots:15\"]}" > /etc/docker/daemon.json

# start docker permanently as a service
systemctl start docker
systemctl enable docker
```

## Customize

Feel free to look at the variables in the `.env` file and `docker-compose.yaml` file.

## Test the application

* Surf to : https://your_ip:8443
* Login with admin / AnsibleForms!123 (or password you chose in the .env file)
* Next steps :
  * Start creating your forms by changing the forms.yaml file or using the built-in designer
  * Add your own playbooks under the data/playbooks/ folder
  * Add ldap connection
  * Add users and groups
  * Add AWX connection
  * Add credentials for custom external connections such as other mysql servers or credentials for rest api's or tho pass to ansible playbooks

## File structure

The docker-compose project comes with the following folder structure :

```bash
.
├── data
│   ├── certificates # folder that contains sample self-signed certificates - replace with your own
│   ├── forms # folder that contains 1 or more yaml files with forms
│   ├── forms_backups # folder to hold form backups
│   ├── functions # folder for custom javascript functions
│   ├── git # folder for git repos
│   ├── images # folder for custom images
│   ├── logs # folder that holds the logfiles
│   ├── mysql
│   │   ├── db # folder that holds the database files
│   │   └── init # contains the sql files to initialize the database
│   ├── playbooks # folder for your ansible playbooks and roles
│   ├── ssh # folder for the client sshkey
│   ├── forms.yaml # the master forms file 
├── k8s # sample files to deploy on Kubernetes
```

# Install docker-image without Docker-Compose

Installing AnsibleForms natively will need good Linux skills and knowledge about Nodejs

## Prerequisites

* **Docker** : Install docker and have it running
* **MySql** : Install Mysql and have it running

## Install MySql

Below is just an example of how you could install MySql

```bash
wget https://dev.mysql.com/get/mysql57-community-release-el7-9.noarch.rpm
sudo rpm -ivh mysql57-community-release-el7-9.noarch.rpm
sudo yum install mysql-server
sudo systemctl start mysqld
sudo grep 'temporary password' /var/log/mysqld.log
sudo mysql_secure_installation
# the above will be interactive
# do NOT disallow remote access
# set new password of choice
```

## Get image from docker hub
If you don't want to go through the hassle of a dockerbuild.  Run a docker image directly from docker hub.  
  
If you want, you can use the latest build from docker hub (https://hub.docker.com/repository/docker/ansibleguy/ansibleforms)
Note that we have deployed the solution in the `/app` folder inside the docker.  So if you want your `forms.yaml`, logs, certificates and playbooks reachable from within the docker image, you have to use a mount path or persistent volume and make sure it's mounted under `/app/dist/persistent`.  
Make sure you have your environment variables set.  Most variables fall back to defaults, but the MySQL database connection is mandatory.  The image contains ansible and python3.  The below command is merely an example. An example of a forms.yaml you can find here (https://github.com/ansibleguy76/ansibleforms/tree/main/server/persistent).

```bash
docker run -p 8000:8000 -d -t --mount type=bind,source=/srv/apps/ansibleforms/server/persistent,target=/app/dist/persistent --name ansibleforms -e DB_HOST=192.168.0.1 -e DB_USER=root -e DB_PASSWORD=password ansibleguy/ansibleforms
```

Once started :

```bash
docker ps
CONTAINER ID   IMAGE                     COMMAND                  CREATED         STATUS         PORTS                                       NAMES
d91f7b05b67e   ansibleguy/ansibleforms   "node ./dist/index.js"   7 seconds ago   Up 6 seconds   0.0.0.0:8000->8000/tcp, :::8000->8000/tcp   ansibleforms
```

## Test the application

* Surf to : https://your_ip:8000
* Login with admin / AnsibleForms!123 (or password you chose in the .env file)
* Next steps :
  * Start creating your forms by changing the forms.yaml file or using the built-in designer
  * Add your own playbooks under the data/playbooks/ folder
  * Add ldap connection
  * Add users and groups
  * Add AWX connection
  * Add credentials for custom external connections such as other mysql servers or credentials for rest api's or tho pass to ansible playbooks

# How to run a custom build

If you are familiar with Node js, you can download the code and build and run this locally, using PM2 for example.
This project has 2 node applications

* A client app in vue
* A server app in express

The client app will dynamically build the forms (vue.js v2) for ansible/awx, based on one or more yaml files (forms.yaml).
The server app (express.js) will cover authentication, background database connections and executing the ansible playbooks or awx templates.

## Prerequisites

* **Ansible or AWX** : Native installation does not cover Ansible, you must have this installed manually

## Project download

```bash
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

## Project init

First we install all nodejs dependencies for both client & server

```bash
cd server
npm install

cd ..
cd client
npm install

cd ..
```

Second we prep our environment variables.  An environment variable file contains the configuration of this application, such as http(s) settings, ldap settings, database connections, log settings, ...
This application comes with an `.env.example` file that you must copy to `.env.development` or `.env.production` and adjust to your needs.  You can maintain both development and production file to test if you have different dev & prod environments and settings.

```bash
cd client
cp .env.example .env.development

cd ..
cd server
cp .env.example .env.development
cp ./persistent/forms.yaml.example ./persistent/forms.yaml
```

## Modify the .env.development (or .env.production) to your needs

* enable https if needed and set the certificates (the code comes with self signed certficates)
* update forms path and log path
* set mysql server connection details

## Modify the forms.yaml to your needs

The `forms.yaml` file describes all your forms in a yaml format.  It must be available in the server application.  By default the webapp will search under `/server/persistent` 

* add categories
* add roles
* add constants
* add forms

## How to run

### In development

First of all one must understand that this application has both a client and server side.
The client side is build with vue2 and compiles in a single html, css & js script file.
The server side is build with express (must also be compiled) and runs the api's and database connections.

All behavior and how things are started using the `npm run command` is in the `package.json` file (one for client and one for server).  There are several methods like 'build, bundle, start, ...' depending on what you want to do.

#### Run both server and client for development

When you test a vue2 application (client application), it typically spins up a temporary Express webserver, which is useless if you also have a server application, which would not be running in this case.  Therefor we have added a `vue.config.js` file which also starts our server code in that temp express server.  Now we start our client app in development, along with the server code.  We also use nodemon to auto rebuild if the code changes.

```bash
cd client
npm run start
```

#### Run compiled in development

If you are done testing, you can compile the client code and have it embedded into the server code.  And then spin up the server application.  the command `npm run bundle` will compile the client code and copy it under `/views` in the server application.  You can then start the server application with `npm run dev`, and as you will see in the `package.json`, it will build, copy the environment file and start the server application in dev mode.

First we compile the client code, and bundle it in the server code

```bash
cd client
npm run bundle
```

Then we run the server code in development mode.  `npm run dev` will also copy the `.env.development` file into the `./dist` folder, so make sure it's there !

```bash
cd ..
cd server
npm run dev
```

### Run in production with PM2

Running the application in the commandline, makes it fragile when something goes wrong.  We need an environment where the nodejs application can run when logged of, where it can be monitored and even restarted in case of a crash.  That's were PM2 comes in. (https://pm2.keymetrics.io/)

```bash
npm install -g pm2
```

We again compile the client code and bundle it in the server code

```bash
cd client
npm run bundle
```

We now compile the server code, but don't start it.

```bash
cd ..
cd server
npm run build
```

Then we copy a production ready environment file. (change it to fit your production environment)

```bash
cp .env.example ./dist/.env.production
```

Then we start it in PM2.  

```bash
cd dist
pm2 start ecosystem.config.js --env production
```

Once started

```bash
# pm2 status
┌─────┬─────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name            │ namespace   │ version │ mode    │ pid      │ uptime │      │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼─────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ ansibleforms    │ default     │ 1.0.0   │ fork    │ 3104     │ 8s     │ 0    │ online    │ 0%       │ 57.1mb   │ root     │ enabled  │
└─────┴─────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

## First time run

The first time you surf to the webapplication, it will ask you if it should create the AnsibleForms schema.  
The default admin user is :

* username : admin
* password : AnsibleForms!123
  