#! /bin/sh

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Are you in the right directory?"
    exit 1
fi

# Get version from package.json
version=$(jq .version ./package.json -r)

# Confirm RC publication
echo "Publishing release candidate: $version-rc"
printf "Continue? (y/n): "
read answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    exit 1
fi

# Build the image
docker build -t ansibleforms .

# Tag and push RC version
docker tag ansibleforms ansibleguy/ansibleforms:$version-rc
docker push ansibleguy/ansibleforms:$version-rc

# Also tag as latest-rc for easy access
docker tag ansibleforms ansibleguy/ansibleforms:latest-rc
docker push ansibleguy/ansibleforms:latest-rc

# Clean up dangling images
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
