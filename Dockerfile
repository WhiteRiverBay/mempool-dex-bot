FROM node:18.1.0


RUN mkdir -p /usr/src/install
COPY nginx/nginx-1.24.0.tar.gz /usr/src/install
RUN cd /usr/src/install && tar -zxvf nginx-1.24.0.tar.gz
#install pcre zlib openssl
RUN apt-get update && apt-get install -y libpcre3 libpcre3-dev zlib1g-dev libssl-dev
RUN cd /usr/src/install/nginx-1.24.0 && ./configure --prefix=/usr/local/nginx --with-http_stub_status_module --with-http_ssl_module --with-pcre=/usr/src/install/pcre-8.44 --with-zlib=/usr/src/install/zlib-1.2.11 --with-openssl=/usr/src/install/openssl-1.1.1k
RUN cd /usr/src/install/nginx-1.24.0 && make && make install
RUN ln -s /usr/local/nginx/sbin/nginx /usr/local/bin/nginx
COPY nginx/nginx.conf /usr/local/nginx/conf/nginx.conf
COPY nginx/ssl_certificate.pem /usr/local/nginx/conf/ssl_certificate.pem
COPY nginx/ssl_certificate_key.pem /usr/local/nginx/conf/ssl_certificate_key.pem

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
COPY src ./src
COPY mempool.sh ./

RUN npm install 

CMD [ "/bin/sh", "mempool.sh" ]
EXPOSE 443