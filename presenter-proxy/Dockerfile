FROM node:4.3.1
WORKDIR /usr/src/app

COPY package.json /usr/src/app/

RUN npm install
RUN npm install -g nodemon

COPY . /usr/src/app/

CMD nodemon
