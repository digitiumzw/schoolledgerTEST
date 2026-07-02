FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY docker/landing/nginx.conf /etc/nginx/conf.d/default.conf

# Copy landing page static files
COPY landingpage/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
