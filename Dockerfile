FROM node:lts-bookworm-slim AS node

##################################################
# base stage
# create a debian image with nodejs, ansible & python + libs

FROM node AS nodebase

# Use /app as CWD
WORKDIR /app

# Update package lists and install packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-ldap \
    libxslt1.1 \
    curl \
    tzdata \
    mariadb-client \
    libmariadb3 \
    openssh-client \
    sshpass \
    git \
    vim \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install github package (now that wget is available)
RUN wget -O /bin/ytt https://github.com/vmware-tanzu/carvel-ytt/releases/download/v0.52.1/ytt-linux-amd64
RUN chmod -R +x /bin/ytt

# install some dev packages
# RUN apk add --update --no-cache --virtual .build-deps g++ gcc libxml2-dev libxslt-dev unixodbc-dev python3-dev postgresql-dev && apk del .build-deps
# looks like this is no longer needed

# Create and activate a virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"
RUN pip install --upgrade pip

# Now install your packages in the venv
RUN pip install pandas PyYAML openpyxl hvac pyVim pyvmomi jinja2 requests six PyMySQL netapp_lib netapp_ontap solidfire-sdk-python boto3 boto botocore lxml ansible

# run ansible galaxy modules
RUN ansible-galaxy collection install netapp.ontap -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.elementsw -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.um_info -p /usr/share/ansible/collections
RUN ansible-galaxy collection install amazon.aws -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.storagegrid -p /usr/share/ansible/collections
RUN ansible-galaxy collection install community.general -p /usr/share/ansible/collections
RUN ansible-galaxy collection install community.mysql -p /usr/share/ansible/collections
RUN ansible-galaxy collection install ansibleguy76.ansibleforms -p /usr/share/ansible/collections

# make ssh directory
RUN mkdir -p ~/.ssh

# update npm
RUN npm install -g npm@11.4.1

##################################################
# builder stage
# intermediate build to compile the client application with vite
# can run in parallel with base stage

FROM node:lts-bookworm-slim AS tmp_builder

# Update npm
RUN npm install -g npm@11.4.1

########## prep client ###########

# Install vite
RUN npm install -g vite

# Use /app/client
WORKDIR /app/client

# Copy client package.json and package-lock.json to /app/client
COPY ./client/package*.json ./

# install node modules for client
RUN npm install

# copy all
COPY ./client ./

# build client
RUN npm run build

######### prep server ##########

# Use /app/server
WORKDIR /app/server

# Copy package.json and package-lock.json to /app/server
COPY ./server/package*.json ./

# install node modules
RUN npm install --omit=dev

# Copy the rest of the code
COPY ./server .

# Copy the docs help file to /app/server
COPY ./docs/_data/help.yaml .

# clean persistent subfolder
RUN rm -rf ./persistent
RUN rm .env.*
RUN rm -rf ./views
RUN mkdir ./views

# Copy built client files to server views directory
RUN cp -r ../client/dist/. ./views


##################################################
# final build
# take base and install production app dependencies
# copy built app from intermediate

FROM nodebase AS final

# for now we still run the app under dist..
WORKDIR /app/dist

# copy the server code, no more compiling needed sing ESM
COPY --from=tmp_builder /app/server/. ./

# Copy the ansible.cfg file to /etc/ansible/ directory
COPY ./server/ansible.cfg /etc/ansible/ansible.cfg

# Use js files to run the application
ENTRYPOINT ["node", "./index.js"]
