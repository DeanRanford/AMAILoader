FROM node:20-bookworm

# Install Wine, Perl, and clean up apt cache to keep image lean
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        wine \
        wine32 \
        wine64 \
        libwine \
        libwine:i386 \
        fonts-liberation \
        perl \
        wget \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy application code and the AMAI folder into the container
COPY server.js ./
COPY public/ ./public/
COPY AMAI/ ./AMAI/

# Create uploads directory for processing maps
RUN mkdir -p uploads

# Set environment variables for Wine (runs headless without GUI prompts)
ENV WINEDEBUG=-all
ENV WINEPREFIX=/root/.wine

# Expose web port
EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.js"]