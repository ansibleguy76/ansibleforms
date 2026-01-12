FROM ansibleguy/ansibleforms-base:latest AS nodebase

##################################################
# builder stage
# intermediate build to compile the client application with vite
# can run in parallel with base stage

FROM ansibleguy/ansibleforms-base:latest AS tmp_builder

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

# clean files
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
