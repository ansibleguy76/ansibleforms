#! /bin/sh

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Are you in the right directory?"
    exit 1
fi

# Confirm base image build
echo "Building and publishing base image: ansibleguy/ansibleforms-base:latest"
printf "This will take a while and should only be done when updating Ansible packages. Continue? (y/n): "
read answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    exit 1
fi

# Build the base image
echo "Building base image (no cache to ensure latest packages)..."
docker build --no-cache -f Dockerfile.base -t ansibleguy/ansibleforms-base:latest .

# Push the base image
echo "Pushing base image..."
docker push ansibleguy/ansibleforms-base:latest

# Clean up dangling images
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true

echo "Base image published successfully!"
echo "You can now use ./publish-rc.sh, ./publish-local.sh, or ./publish.sh for much faster builds."