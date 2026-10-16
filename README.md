# AMAILoader

AMAILoader runs AMAI's map installer in Wine and provides a web interface for
installing AMAI on Warcraft III maps. The installer code and files in `AMAI/`
are used as provided; the Docker build compiles the required AMAI script
profiles.

## Run on Linux with Docker

```sh
docker build -t amai-web-app .
docker run --rm -p 3000:3000 --name amai-container amai-web-app
```

Open `http://localhost:3000`, select one or more `.w3m` or `.w3x` maps, and
choose the Warcraft III version and commander mode. AMAI's optimized scripts
are used for every install. One map downloads as an AMAI-installed map;
multiple maps download together as `AMAI_maps.zip`. The container installs
Wine and the Linux `zip` utility as build dependencies.

For running the app outside Docker, Linux must have Wine, `zip`, and a Wine
prefix with Strawberry Perl at `C:/strawberry/perl/bin/perl.exe`. Set
`WINEPREFIX` if the prefix is not `$HOME/.wine`.

The installer uses the `InstallToDir.pl` workflow documented by AMAI to
process every map in the uploaded job directory.

## Rebuild and run

```sh
docker build --no-cache -t amai-web-app .
docker run -d --rm -p 3000:3000 --name amai-container amai-web-app
```
