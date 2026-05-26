#!/bin/bash
set -euo pipefail

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Are you in the right directory?"
    exit 1
fi

# Check for dirty git state
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is dirty. Commit or stash your changes first."
    git status --short
    exit 1
fi

# Get version from package.json
version=$(jq .version ./server/package.json -r)

# Confirm RC publication
echo "Publishing release candidate: $version-rc"
printf "Continue? (y/n): "
read answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    exit 1
fi

# Step 1: Build public schema
echo "🔨 Building public schema..."
./server/schema/build-public-schema.sh

# Step 2: Check if schema changed and commit
if [ -n "$(git status --porcelain server/schema/public/)" ]; then
    echo "📝 Schema changed, committing..."
    git add server/schema/public/
    git commit -m "chore: update public schema for v$version-rc"
    git push
    echo "✅ Schema committed and pushed"
else
    echo "✅ Schema unchanged"
fi

# Step 3: Get clean git SHA and build time
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🐳 Building Docker image with SHA: $GIT_SHA"

# Step 4: Build Docker with build args
docker build \
    --build-arg GIT_SHA="$GIT_SHA" \
    --build-arg BUILD_TIME="$BUILD_TIME" \
    -t ansibleforms .

# Tag and push RC version
docker tag ansibleforms ansibleguy/ansibleforms:$version-rc
docker push ansibleguy/ansibleforms:$version-rc

# Also tag as latest-rc for easy access
docker tag ansibleforms ansibleguy/ansibleforms:latest-rc
docker push ansibleguy/ansibleforms:latest-rc

# Clean up dangling images
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true

echo "✅ Published ansibleguy/ansibleforms:$version-rc (SHA: $GIT_SHA)"

# Run post-script if it exists (for custom deployment, scp, etc.)
if [ -f "./publish-rc.post.sh" ]; then
    echo "🔧 Running post-script..."
    ./publish-rc.post.sh
fi
