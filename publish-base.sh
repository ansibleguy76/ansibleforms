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

# Ensure we're logged into Docker Hub as the expected user.
# Override by exporting DOCKER_HUB_USER=someoneelse before running the script.
DOCKER_HUB_USER="${DOCKER_HUB_USER:-ansibleguy}"
CURRENT_DOCKER_USER=$(docker info 2>/dev/null | awk -F': ' '/^ Username:/ {print $2}' | tr -d '[:space:]')
if [ "$CURRENT_DOCKER_USER" != "$DOCKER_HUB_USER" ]; then
    if [ -n "$CURRENT_DOCKER_USER" ]; then
        echo "⚠️  Currently logged in as '$CURRENT_DOCKER_USER', need '$DOCKER_HUB_USER'. Switching..."
    else
        echo "🔑 Not logged into Docker Hub. Logging in as '$DOCKER_HUB_USER'..."
    fi
    # Personal access tokens live OUTSIDE the repo, one "user:token" per line, in
    # ~/.ansibleforms-docker-pat (chmod 600) - never in a tracked file. Falls back to an
    # interactive prompt for any account not listed there.
    DOCKER_HUB_TOKEN=""
    if [ -f "$HOME/.ansibleforms-docker-pat" ]; then
        DOCKER_HUB_TOKEN=$(awk -F: -v u="$DOCKER_HUB_USER" '$1==u {print $2}' "$HOME/.ansibleforms-docker-pat")
    fi
    if [ -n "$DOCKER_HUB_TOKEN" ]; then
        echo "$DOCKER_HUB_TOKEN" | docker login -u "$DOCKER_HUB_USER" --password-stdin
    else
        docker login -u "$DOCKER_HUB_USER"
    fi
else
    echo "✅ Logged into Docker Hub as '$DOCKER_HUB_USER'"
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