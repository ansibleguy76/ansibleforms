# Deprecated Features

This document tracks deprecated features that will be **removed in v7.0.0** (breaking changes).

> **Note:** v7 will be the first major version to remove backward compatibility for these features.

---

## Configuration Architecture (Deprecated in v6.0.0)

### 1. forms.yaml File Structure
**Status:** DEPRECATED  
**Replacement:** `config.yaml` + `forms/` folder  
**Timeline:** Remove in v7.0.0

#### What's Changing
- **OLD:** Single `forms.yaml` containing both configuration (categories, roles, constants) and form definitions
- **NEW:** 
  - `config.yaml` for application configuration only
  - `forms/` folder for individual form files

#### Developer Impact (v7 Cleanup)
When v7 removes support, delete:

**Backend Code:**
- `form.model.js`:
  - Remove `legacyFormFilePath` variable
  - Remove `legacyFormFileName` variable  
  - Remove `legacyFormFileBackupPath` variable
  - Remove fallback logic in `getConfigPath()` - only check `config.yaml`
  - Remove `isLegacy` return property from `getConfigPath()`
  - Remove deprecation warning in `getBaseConfig()`
  - Remove check for forms in base config file (line ~344: "Found forms in base config file. This is DEPRECATED...")
  
- `repository.model.js`:
  - Remove `Repository.getFormsPath()` method entirely
  - Update `Repository.getConfigPath()` to only check `config.yaml` (remove forms.yaml fallback)

- `settings.model.js`:
  - Remove forms.yaml fallback in `Settings.importFormsFileFromYaml()`
  - Simplify to only import from config.yaml

**Templates:**
- Consider removing `templates/forms.yaml.template` (only keep `config.yaml.template`)

**Frontend:**
- `settings.vue`: Remove deprecation warning message
- `error.vue`: Remove reference to "or legacy forms.yaml"
- `designer.vue`: Remove deprecation message about forms in config

---

### 2. FORMS_PATH Environment Variable
**Status:** DEPRECATED  
**Replacement:** `CONFIG_PATH` + `FORMS_FOLDER_PATH`  
**Timeline:** Remove in v7.0.0

#### What's Changing
- **OLD:** `FORMS_PATH` pointed to forms.yaml (combined config + forms location)
- **NEW:**
  - `CONFIG_PATH` → Path to config.yaml (default: `persistent/config.yaml`)
  - `FORMS_FOLDER_PATH` → Path to forms folder (default: `persistent/forms`)

#### Developer Impact (v7 Cleanup)
**Backend Code:**
- `app.config.js`:
  - Remove `formsPath: process.env.FORMS_PATH || ...`
  - Remove comment "// DEPRECATED: Use configPath and formsFolderPath instead"

**Documentation:**
- Remove all references to `FORMS_PATH` from installation docs
- Update Docker/K8s examples to use new env vars only

---

### 3. Forms in Base Config File
**Status:** DEPRECATED  
**Replacement:** Individual form files in `forms/` folder  
**Timeline:** Remove in v7.0.0

#### What's Changing
- **OLD:** Forms could be defined directly in forms.yaml/config.yaml under `forms:` key
- **NEW:** Each form is a separate YAML file in the `forms/` folder (supports subdirectories)

#### Developer Impact (v7 Cleanup)
**Backend Code:**
- `form.model.js`:
  - Remove lines ~344-346 (warning about forms in base config)
  - Remove `unvalidatedForms` extraction from base config
  - Remove `delete f.source` logic for base forms
  - Start directly from empty forms array and only load from `forms/` folder

---

## Summary of v7.0.0 Breaking Changes

### Files/Code to Remove:
1. **Variables:**
   - `legacyFormFilePath`
   - `legacyFormFileName`
   - `legacyFormFileBackupPath`
   - `appConfig.formsPath`

2. **Functions/Methods:**
   - `Repository.getFormsPath()` - remove entirely
   - `getConfigPath()` - simplify to only return config.yaml path
   - All fallback logic checking for forms.yaml

3. **Templates:**
   - `templates/forms.yaml.template` (optional - keep for migration reference)

4. **Environment Variables:**
   - Remove support for `FORMS_PATH`

5. **Features:**
   - Remove ability to define forms in config.yaml
   - Remove forms.yaml file format support

### Migration Path for Users
Before upgrading to v7, users must:
1. Rename `forms.yaml` → `config.yaml`
2. Remove `forms:` section from config file
3. Create individual form files in `forms/` folder
4. Update environment variables: `FORMS_PATH` → `CONFIG_PATH` + `FORMS_FOLDER_PATH`
5. Update volume mounts in Docker/K8s deployments

### Backward Compatibility Timeline
- **v6.x:** Full backward compatibility with deprecation warnings
- **v7.0.0:** Breaking changes - legacy support removed
- **Recommendation:** Provide migration tool/script before v7 release

---

## Already Removed (v6.0.0)

These features were removed in v6 and are **not** subject to future deprecation:

### Notification System
- ✅ `on` property - Removed (replaced by `onStatus` and `onEvent`)
- ✅ Individual event properties (`onLaunch`, `onRelaunch`, `onDelete`, `onApprove`, `onReject`) - Removed (consolidated into `onEvent` array)

---

## Migration Recommendations

### For v7 Development:
1. Create automated migration script that:
   - Detects forms.yaml and prompts migration
   - Automatically splits config from forms
   - Updates environment variables
   
2. Add startup validation that:
   - Fails hard if forms.yaml exists (no fallback)
   - Requires config.yaml to be present
   - Verifies forms/ folder structure

3. Documentation updates:
   - Clear migration guide from v6 → v7
   - Updated quick start examples
   - Docker/K8s deployment examples

### Testing Checklist Before v7:
- [ ] Fresh installation uses only config.yaml + forms/
- [ ] No forms.yaml fallback code paths execute
- [ ] All tests pass without legacy files
- [ ] Docker images work with new structure
- [ ] Git repositories use new structure
- [ ] Database imports work with config.yaml only
