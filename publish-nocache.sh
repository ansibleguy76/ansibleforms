#! /bin/sh

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Are you in the right directory?"
    exit 1
fi

# Get version and confirm
version=$(jq .version ./package.json -r)
echo "Publishing production version (no-cache): $version"
printf "Continue? (y/n): "
read answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    exit 1
fi

docker build --no-cache -t ansibleforms .
docker tag ansibleforms ansibleguy/ansibleforms
docker push ansibleguy/ansibleforms
docker tag ansibleforms ansibleguy/ansibleforms:$version
docker push ansibleguy/ansibleforms:$version
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
