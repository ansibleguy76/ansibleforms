FROM node:16-alpine AS node

##################################################
# base stage
# create an alpine image with nodejs, ansible & python + libs

FROM node AS nodebase

# Use /app as CWD
WORKDIR /app

# Install github package
RUN wget -O /bin/ytt github.com/vmware-tanzu/carvel-ytt/releases/download/v0.49.0/ytt-linux-amd64
RUN chmod -R +x /bin/ytt

# isntall apk packages
RUN apk add py3-pip py3-pyldap libxslt mysql-client curl tzdata mariadb-connector-c openssh sshpass git vim

# install some dev packages
# RUN apk add --update --no-cache --virtual .build-deps g++ gcc libxml2-dev libxslt-dev unixodbc-dev python3-dev postgresql-dev && apk del .build-deps
# looks like this is no longer needed

# install pip3 packages
RUN pip3 install requests six PyMySQL netapp_lib netapp_ontap solidfire-sdk-python boto3 boto botocore lxml ansible passlib

# run ansible galaxy modules
RUN ansible-galaxy collection install netapp.ontap -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.elementsw -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.um_info -p /usr/share/ansible/collections
RUN ansible-galaxy collection install amazon.aws -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.storagegrid -p /usr/share/ansible/collections
RUN ansible-galaxy collection install community.general -p /usr/share/ansible/collections
RUN ansible-galaxy collection install community.mysql -p /usr/share/ansible/collections

# make ssh directory
RUN mkdir -p ~/.ssh

# update npm
RUN npm install -g npm@9.8.1

##################################################
# builder stage
# intermediate build to compile application
# can run in parallel with base stage

FROM node AS tmp_builder

# Use /app
WORKDIR /app

# Copy package.json and package-lock.json to /app
COPY package*.json ./

# Update npm
RUN npm install -g npm@9.8.1

# install node modules
RUN npm install

# Copy the rest of the code
COPY . .

# Invoke the build script to transpile code to js
RUN npm run build

# Remove persistent subfolder
RUN rm -rf ./dist/persistent

##################################################
# final build
# take base and install production app dependencies
# copy built app from intermediate

FROM nodebase as final

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm i --only=production

# Copy transpiled js from builder stage into the final image
COPY --from=tmp_builder /app/dist ./dist

# Copy the ansible.cfg file to /etc/ansible/ directory
COPY ansible.cfg /etc/ansible/ansible.cfg

# Use js files to run the application
ENTRYPOINT ["node", "./dist/index.js"]
