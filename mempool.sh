#!/bin/bash
# start nginx
/usr/local/nginx/sbin/nginx
# start node
node src/bot/mempool_bot.js
