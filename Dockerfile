# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Proxy /chat and /explain_mistake to the chatbot container.
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Serve the same-origin chatbot config (browser talks to the nginx proxy).
COPY docker/chatbotConfig.js /usr/share/nginx/html/chatbotConfig.js
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
