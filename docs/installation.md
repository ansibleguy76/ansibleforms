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
        content: Home
        url: '/index'
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

I will only discuss the use of `Docker Compose`, which is the fastest way to start AnsibleForms with Docker.  However, if you are skilled with docker and/or Kubernetes, the [docker-compose (with Kubernetes sample)](https://github.com/ansibleguy76/ansibleforms-docker), together with the environment variables should get you started as well.

<div class="callout callout--danger">
    <p><strong>Note</strong> Using docker and docker-compose for the first time, requires some basic linux skills and some knowledge about containers</p>
    <p><a href="#todo">Download this document</a> To get you kick-started with containers and Docker</p>
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

# Customize

Feel free to look at the variables in the `.env` file and `docker-compose.yaml` file.

# Test the application

* Surf to : https://your_ip:8443
* Login with admin / AnsibleForms!123 (or password you chose in the .env file)
* Next steps :
  * Start creating your forms by changing the forms.yaml file or using the built-in designer
  * Add your own playbooks under the data/playbooks/ folder
  * Add ldap connection
  * Add users and groups
  * Add AWX connection
  * Add credentials for custom external connections such as other mysql servers or credentials for rest api's or tho pass to ansible playbooks

# File structure

The docker-compose project comes with the following folder structure :

```bash
.
├── data
│   ├── certificates
│   ├── forms
│   ├── forms_backups
│   ├── functions
│   ├── git
│   ├── images
│   ├── logs
│   ├── mysql
│   │   ├── db
│   │   └── init
│   ├── playbooks
│   ├── ssh
├── k8s
├── secrets
```

