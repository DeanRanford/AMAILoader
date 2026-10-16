FROM node:20-bookworm

# Enable i386 architecture for Wine, install Wine, unzip, and system certificates
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        wine \
        wine32 \
        wine64 \
        libwine \
        libwine:i386 \
        fonts-liberation \
        wget \
        unzip \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set up working directory inside the container
WORKDIR /app

# Copy package files and install Node dependencies first (for better caching)
COPY package.json ./
RUN npm install

# Copy application files and AMAI repository contents
COPY server.js ./
COPY public/ ./public/
COPY AMAI/ ./AMAI/

# Create the uploads/jobs workspace directory
RUN mkdir -p uploads

# Configure Wine environment variables for headless execution
ENV WINEDEBUG=-all
ENV WINEPREFIX=/root/.wine

# Download and extract Strawberry Perl Portable into Wine's virtual C drive
# (Required because AMAI batch scripts rely on Perl for internal precompilation)
RUN mkdir -p /root/.wine/drive_c/strawberry && \
    wget https://strawberryperl.com/download/5.30.2.1/strawberry-perl-5.30.2.1-64bit-portable.zip -O /tmp/perl.zip && \
    unzip /tmp/perl.zip -d /root/.wine/drive_c/strawberry && \
    rm /tmp/perl.zip

# Expose the web application port
EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.js"]