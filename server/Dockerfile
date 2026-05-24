FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests
COPY package*.json ./

# Install packages including compilation dependencies
RUN npm install

# Bundle source code
COPY . .

# Expose server port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
