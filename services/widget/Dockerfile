FROM node:22-alpine AS build
WORKDIR /app
COPY services/widget/package.json ./services/widget/
RUN cd services/widget && npm install
COPY services/widget ./services/widget
RUN cd services/widget && npm run build

FROM nginx:alpine
COPY --from=build /app/services/widget/dist /usr/share/nginx/html
COPY services/widget/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
