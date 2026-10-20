FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
RUN npm install -g tsx
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
ENV PATCHRIGHT_HEADLESS=true
CMD ["tsx", "src/main.ts"]
