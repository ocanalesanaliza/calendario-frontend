FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/templates/default.conf
COPY nginx.maintenance.conf /etc/nginx/templates/maintenance.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/40-select-maintenance-mode.sh
RUN chmod +x /docker-entrypoint.d/40-select-maintenance-mode.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]