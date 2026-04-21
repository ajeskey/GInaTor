# GInaTor production container image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY source/ ./source/

EXPOSE 3000

CMD ["node", "source/app.js"]
