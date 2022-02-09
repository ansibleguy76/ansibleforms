FROM node:14-alpine AS node

##################################################
# base stage
# create an alpine image with nodejs, ansible & python + libs

FROM node AS nodebase

# Use /app as CWD
WORKDIR /app

# install ansible
RUN apk add ansible

# upgrade pip
RUN apk add py3-pip

# install some python dependencies
RUN pip3 install requests six
RUN apk add --update --no-cache --virtual .build-deps g++ gcc libxml2-dev libxslt-dev python3-dev
RUN apk add --no-cache libxslt
RUN apk add --no-cache mysql-client
RUN apk add --no-cache curl
RUN pip3 install --no-cache-dir lxml
RUN apk del .build-deps
RUN pip3 install PyMySQL
RUN pip3 install netapp_lib
RUN pip3 install solidfire-sdk-python

# run ansible galaxy modules
RUN ansible-galaxy collection install netapp.ontap -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.elementsw -p /usr/share/ansible/collections
RUN ansible-galaxy collection install netapp.um_info -p /usr/share/ansible/collections

# add ssh
RUN apk add openssh
RUN mkdir -p ~/.ssh

##################################################
# builder stage
# intermediate build to compile application

FROM node AS tmp_builder

# Use /app
WORKDIR /app

# Copy package.json and package-lock.json to /app
COPY package*.json ./

# Install all dependencies
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

# Use js files to run the application
ENTRYPOINT ["node", "./dist/index.js"]
