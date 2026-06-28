FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
RUN addgroup -S flowwatch && adduser -S flowwatch -G flowwatch
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && apk del python3 make g++
RUN mkdir -p /app/data && chown -R flowwatch:flowwatch /app/data
EXPOSE 3000
USER flowwatch
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/src/index.js"]
