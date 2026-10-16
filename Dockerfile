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
        zip \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js ./
COPY public/ ./public/
COPY AMAI/ ./AMAI/

RUN mkdir -p uploads

ENV WINEDEBUG=-all
ENV WINEPREFIX=/root/.wine
ENV WINEPATH="C:\\strawberry\\perl\\bin"

# Install Strawberry Perl Portable into Wine's virtual C drive
RUN mkdir -p /root/.wine/drive_c/strawberry && \
    wget https://strawberryperl.com/download/5.30.2.1/strawberry-perl-5.30.2.1-64bit-portable.zip -O /tmp/perl.zip && \
    unzip /tmp/perl.zip -d /root/.wine/drive_c/strawberry && \
    rm /tmp/perl.zip

# Build in a temporary copy: Wine's cmd does not support the backtick command
# used by AMAI's perlcheck.bat. The bundled Perl version is pinned above.
RUN wine C:/strawberry/perl/bin/perl.exe -e "exit 0" && \
    cp -a AMAI /tmp/amai-build && \
    printf '@echo off\r\nexit /b 0\r\n' > /tmp/amai-build/perlcheck.bat && \
    cd /tmp/amai-build && \
    wine cmd.exe /c MakeREFORGED.bat && \
    wine cmd.exe /c MakeTFT.bat && \
    wine cmd.exe /c MakeROC.bat && \
    for version in REFORGED TFT ROC; do \
        test -s "Scripts/$version/common.ai" && \
        test -s "Scripts/$version/Blizzard.j" && \
        test -s "Scripts/$version/vsai/Blizzard.j" && \
        test -n "$(find "Scripts/$version" -maxdepth 1 -name '*.ai' -print -quit)"; \
    done && \
    cp -a Scripts /app/AMAI/ && \
    rm -rf /tmp/amai-build

EXPOSE 3000

CMD ["node", "server.js"]