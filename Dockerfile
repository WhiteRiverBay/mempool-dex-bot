FROM node:18.1.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
COPY src ./src
COPY mempool.sh ./

RUN npm install 

CMD [ "/bin/sh", "mempool.sh" ]
EXPOSE 5001