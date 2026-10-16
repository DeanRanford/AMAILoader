# AMAILoader

docker build -t amai-web-app .
docker run -d -p 3000:3000 --name amai-container amai-web-app



##

# 1. Stop and remove the old container (if it's still running or exists)
docker stop amai-container
docker rm amai-container

# 2. Rebuild the Docker image from scratch (ignoring cache)
docker build --no-cache -t amai-web-app .

# 3. Run the new container
docker run -d -p 3000:3000 --name amai-container amai-web-app