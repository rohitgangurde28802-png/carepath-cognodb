FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY public ./public
COPY scripts ./scripts
COPY src ./src
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
