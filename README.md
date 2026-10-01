# Intro
Ansible forms is a lightweight node.js webapplication to generate userfriendly and pretty forms to kickoff ansible playbooks or awx (ansible tower) templates.

# Changed recently 

## Vite vs webpack
We took the path to Vite (instead of webpack & babel).  This means that the code is now ESM only.  This means that you can not use "require" anymore, but you can use "import" and "export default".  Custom functions must be rewritten to use the new ESM syntax. (/functions/custom.js is an example where this could break).

## Latest packages

A whole bunch of packages are updated, so there might be some breaking changes in the packages.  I have tested the most important ones, but please report if you find any issues.  In the backend, ALL packages are latest now.  Using Node 20.  In the frontend, all packages are update as far as Vue 2 supports it.  This means that the frontend is still Vue 2, but the packages are updated to latest versions.

## Bootstrap 5.3

Bootstrap is now used (instead of Bulma) and themes are now added (docs will follow)

## Forms live in their own files (7.0.0)

The base config (`config.yaml`, or the database) holds the categories, roles and constants only. Every form is a file of its own in the forms folder (`FORMS_FOLDER_PATH`) or in a forms repository. The old single `forms.yaml` and forms inside the base config are no longer read since 7.0.0 - see the upgrade guide.

## The REST API

The REST API is `/api/v2/` (interactive docs at `/api/v2/docs`). API v1 was removed in 7.0.0.

## Introducing helm charts

A new helm chart repo is added

# Deployment topology

AnsibleForms is designed to run as a **single instance**. There is no support today for running multiple replicas behind a load balancer: schema migrations, the scheduler/cron loop, and the job runner all assume they are the only writer. Running more than one instance against the same database can cause migration races, duplicated scheduled jobs and corrupted job state. If you need HA, run a single active instance with restart-on-failure and back up the database + persistent volume.

# Configuration / documentation
[Go to the documentation website](https://ansibleforms.com)

# Future plans

## ORM
The backend is now using mysql server and plain sql statements.  There are plans to move to SqlAlchemy, but this is not yet implemented.  Moving to SqlAlchemy will allow to use other databases like postgresql, sqlite, etc.  This is a long term plan.

## Kubernetes
More focus to Kubernetes will folow.

## Multi person development
Senior node.js developers would be welcome, up till now this is still a one person project that started as POC one day like "How hard can it be to make a webapplication to kickoff ansible playbooks?".  
