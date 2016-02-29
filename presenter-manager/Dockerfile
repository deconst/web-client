FROM alpine
WORKDIR /usr/src/app

RUN apk update && \
    apk add --update docker nodejs

COPY package.json /usr/src/app/

RUN npm install
RUN npm install -g -d nodemon

COPY . /usr/src/app/

CMD nodemon
