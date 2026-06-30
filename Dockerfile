FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server/package*.json ./server/
RUN cd server && npm install

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["node", "server/index.js"]
