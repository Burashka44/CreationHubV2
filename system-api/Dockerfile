FROM node:20-alpine

WORKDIR /app

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 9292

CMD ["node", "index.js"]
