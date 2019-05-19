FROM node:10.15.3

WORKDIR /rri

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 1337

CMD ["npm", "run", "start:node"]
