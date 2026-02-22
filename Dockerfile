FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/techhelp.conf

# Copy static site into the image
COPY index.html   /usr/share/nginx/html/
COPY style.css    /usr/share/nginx/html/
COPY tehhelp.js   /usr/share/nginx/html/
COPY pages.json   /usr/share/nginx/html/
COPY pages/       /usr/share/nginx/html/pages/

EXPOSE 80
