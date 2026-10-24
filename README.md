# AMAILoader

Wraps up AMAI into a Docker container to easily run in codepaces. Exposes a frontend to upload 1 or more maps (not too many at a time) and deploy the amai scripts into the maps

0. Open as a codespace
1. Update the git AMAI submodule to the latest version if needed (and rebuild the docker image)
2. docker build --no-cache -t amai-web-app .
3. docker run -d --rm -p 3000:3000 --name amai-container amai-web-app
4. Set the forwarded port to public in the vscode web view.
5. Access the URL.

6. Alternatively look a the publishfolder.ps1 to mass submit a folder


---

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
choose the Warcraft III version and commander mode. You can optionally force
the AI chat language (English by default) or disable AI bot chatter. AMAI's
optimized scripts are used for every install. One map downloads as an
AMAI-installed map; multiple maps download together as `AMAI_maps.zip`. The
container installs Wine and the Linux `zip` utility as build dependencies.

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
