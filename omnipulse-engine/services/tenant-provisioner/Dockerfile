FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
EXPOSE 3002
CMD ["tsx", "src/index.ts"]
