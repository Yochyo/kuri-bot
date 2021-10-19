FROM node:14
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build
CMD [ "node", "bin/index.js" ]
