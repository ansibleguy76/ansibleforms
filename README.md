# Intro
Ansible forms is a lightweight node.js webapplication to generate userfriendly and pretty forms to kickoff ansible playbooks or awx (ansible tower) templates.

# Breaking changes in v5.1.0 and Future improvements

## Vite vs webpack
We took the path to Vite (instead of webpack & babel).  This means that the code is now ESM only.  This means that you can not use "require" anymore, but you can use "import" and "export default".  Custom functions must be rewritten to use the new ESM syntax. (/functions/custom.js is an example where this could break).

## Latest packages

A whole bunch of packages are updated, so there might be some breaking changes in the packages.  I have tested the most important ones, but please report if you find any issues.  In the backend, ALL packages are latest now.  Using Node 20.  In the frontend, all packages are update as far as Vue 2 supports it.  This means that the frontend is still Vue 2, but the packages are updated to latest versions.

## Bulma v1.0.4

The bulma framework is updated to v1.0.4.  SASS is now using dart-sass instead of node-sass, which is deprecated.  This means that the bulma framework is now using the latest version of SASS, which has some breaking changes.  The old theme (colours & fonts mainly) is broken for bulma v1, so it might look a bit different here and there. (but note that v6 will have bootstrap)

## Depracated forms in the forms.yaml file.

The forms.yaml file used to be the sole source of truth for the forms.  Then forms in folder format were added.  Slowely it became clear that the forms.yaml file should basically be separated from the forms and only contain the categories, roles & constants.  From 5.1.0 onwards a deprecated message will appear when you use forms in the forms.yaml file.  In next releases, the forms.yaml file will be renamed to config.yaml, still supporting the forms.yaml fallback.  Later on the forms.yaml file will be removed and only the forms in the folder format will be supported.  This is a long term plan, so no need to panic.  Note that the forms.yaml can already be moved to the database.  Certainly in Kubernetes this is the preferred way to go.  

# Future path

## Introducing v6

I'm working in parallel with v5.1.x on a new frontend, which will be based on Vue 3 and Bootstrap 5.  This will be a major change, but we are working hard to keep the same functionality and look & feel.  The backend however is shared.

## Introduction /api/v2/

The API will slowly be updated to v2.  The old v1 api will still be available, but the new v2 api will be the default.  The v2 api is more RESTful standard and has some improvements in the way data is returned, also using proper 40x error codes.  The v2 api is not yet fully implemented, but we I'm working on it.  As a user, this will make no difference.  As a developer, the new v2 api should feel more natural and easier to use.  The v2 api is not yet fully implemented, but we are working on it.

More pagination and filtering will be added to the v2 api.  This is a long term plan.

## SqlAlchemy
The backend is now using mysql server and plain sql statements.  There are plans to move to SqlAlchemy, but this is not yet implemented.  Moving to SqlAlchemy will allow to use other databases like postgresql, sqlite, etc.  This is a long term plan.

## Kubernetes
More focus to Kubernetes will folow.

## Revisioning
Bit by bit revisioning.  Senior node.js developers would be welcome, up till now this is still a one person project that started as POC one day like "How hard can it be to make a webapplication to kickoff ansible playbooks?".  

# Configuration / documentation
[Go to the documentation website](https://ansibleforms.com)
