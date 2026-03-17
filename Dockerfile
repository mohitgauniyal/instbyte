FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Data directory — this is where the volume gets mounted
# INSTBYTE_DATA and INSTBYTE_UPLOADS are picked up by db.js and server.js
ENV INSTBYTE_DATA=/data
ENV INSTBYTE_UPLOADS=/data/uploads
ENV INSTBYTE_BOOT=1

# Create the data dir inside image as fallback
RUN mkdir -p /data/uploads

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

# Run the server directly — not via instbyte.js (that's the npx bin)
CMD ["npm", "run", "server"]
