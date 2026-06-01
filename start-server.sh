#!/bin/bash
cd /home/z/my-project
export PORT=3000
export NODE_ENV=production
exec node .next/standalone/server.js >> /home/z/my-project/server.log 2>&1
