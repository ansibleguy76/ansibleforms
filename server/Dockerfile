FROM node:14-alpine AS node


# Builder stage

FROM node AS builder

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

# Final stage


FROM node AS final

# Prepare a destination directory for js files
RUN mkdir -p /server/dist

# Use /app as CWD
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm i --only=production

# Copy transpiled js from builder stage into the final image
COPY --from=builder /app/dist ./dist

# Open desired port
# EXPOSE 8000

# install ansible
RUN apk add ansible

# upgrade pip
RUN apk add py3-pip

# install some python dependencies
RUN pip3 install requests six
RUN apk add --update --no-cache --virtual .build-deps g++ gcc libxml2-dev libxslt-dev python3-dev
RUN apk add --no-cache libxslt
RUN pip3 install --no-cache-dir lxml
RUN apk del .build-deps
RUN pip3 install --upgrade netapp_lib

# run ansible galaxy modules
RUN ansible-galaxy collection install netapp.ontap
RUN ansible-galaxy collection install netapp.um_info

# Use js files to run the application
ENTRYPOINT ["node", "./dist/index.js"]
