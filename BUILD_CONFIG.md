# Build Scripts Configuration

## Post-Build Scripts (Optional)

Build scripts can execute optional post-scripts for custom deployment tasks (like copying Docker images to remote servers).

### How it works:

1. **Copy the example template:**
   ```bash
   cp publish-rc.post.sh.example publish-rc.post.sh
   chmod +x publish-rc.post.sh
   ```

2. **Edit with your credentials:**
   ```bash
   # publish-rc.post.sh contains your actual passwords/IPs
   # This file is gitignored - safe to keep credentials here
   ```

3. **Run the main script:**
   ```bash
   ./publish-rc.sh
   # Automatically runs publish-rc.post.sh at the end if it exists
   ```

### Available post-scripts:
- `publish-rc.post.sh` - Runs after RC build
- `publish.post.sh` - Runs after production build
- `publish-local.post.sh` - Runs after local build

**All .post.sh files are gitignored** - safe to store credentials!
