FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

# MCP servers use stdio transport
ENTRYPOINT ["node", "src/index.mjs"]
