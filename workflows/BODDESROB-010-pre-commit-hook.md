# BODDESROB-010: Add Pre-commit Hook for Body Descriptor Validation

**Status**: TODO
**Priority**: LOW
**Phase**: 5 (Automated Testing)
**Estimated Effort**: 0.5 days
**Dependencies**: BODDESROB-007, BODDESROB-009

## Overview

Create a pre-commit hook that automatically validates body descriptor consistency before commits are allowed. This provides the final safety net to prevent invalid configurations from being committed to the repository.

## Problem Context

Even with validation tools and automated tests, developers might:
- Forget to run validation before committing
- Commit partial changes that break consistency
- Accidentally remove descriptors from configuration
- Update registry without updating config

A pre-commit hook automatically catches these issues before they enter the codebase.

## Acceptance Criteria

- [ ] Pre-commit hook script created
- [ ] Hook runs body descriptor validation
- [ ] Hook runs consistency tests
- [ ] Fast execution (< 10 seconds)
- [ ] Clear error messages on failure
- [ ] Easy to bypass for emergencies (documented)
- [ ] Works with Git workflow
- [ ] Documentation for setup
- [ ] Optional/configurable (not forced on all developers)

## Technical Details

### Approach Options

#### Option A: Simple Git Hook (Recommended)

Create a Git hook in `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔍 Validating body descriptors before commit..."

# Run validation tool
npm run validate:body-descriptors --silent

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Body descriptor validation failed!"
  echo "   Fix the errors and try again."
  echo ""
  echo "   To bypass this check (emergency only):"
  echo "   git commit --no-verify"
  echo ""
  exit 1
fi

# Run consistency tests
npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js --silent

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Body descriptor consistency tests failed!"
  echo "   Fix the errors and try again."
  echo ""
  exit 1
fi

echo "✅ Body descriptor validation passed"
exit 0
```

#### Option B: Husky + lint-staged

Use Husky for Git hooks management:

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run validate:body-descriptors && npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js --silent"
    }
  }
}
```

#### Option C: Script-based Hook

Create installable hook script:

```javascript
// scripts/install-git-hooks.js

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hookContent = `#!/bin/bash

echo "🔍 Validating body descriptors before commit..."

npm run validate:body-descriptors --silent

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Body descriptor validation failed!"
  echo "   Fix the errors and try again."
  echo "   To bypass: git commit --no-verify"
  echo ""
  exit 1
fi

npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js --silent

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Consistency tests failed!"
  echo "   Fix the errors and try again."
  echo ""
  exit 1
fi

echo "✅ Validation passed"
exit 0
`;

const hookPath = path.join(__dirname, '../.git/hooks/pre-commit');

try {
  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  console.log('✅ Pre-commit hook installed successfully');
  console.log('   Location:', hookPath);
} catch (err) {
  console.error('❌ Failed to install pre-commit hook:', err.message);
  process.exit(1);
}
```

**Recommendation**: Use Option A (Simple Git Hook) with Option C (Installation Script) for simplicity and control.

### Implementation Steps

1. **Create Installation Script**
   - Create `scripts/install-git-hooks.js`
   - Implement hook installation logic
   - Add NPM script

2. **Create Hook Content**
   - Write hook bash script
   - Add validation commands
   - Add clear error messages
   - Add bypass instructions

3. **Add NPM Scripts**
   - Add `install-hooks` script
   - Update `postinstall` (optional)

4. **Test Hook**
   - Install hook
   - Test with valid changes
   - Test with invalid changes
   - Test bypass mechanism

5. **Document Usage**
   - Add to README.md
   - Document bypass for emergencies
   - Add troubleshooting guide

### Hook Behavior

**When to Run:**
- Before every commit
- Only on commits that affect anatomy files (optional filter)

**What to Check:**
1. Run validation tool (`npm run validate:body-descriptors`)
2. Run consistency tests
3. Return exit code 0 (success) or 1 (failure)

**Exit Codes:**
- 0: Validation passed, commit proceeds
- 1: Validation failed, commit blocked

### Performance Optimization

To keep hook fast:
- Run only necessary checks
- Cache test results if possible
- Skip if no anatomy files changed (optional)
- Use `--silent` flag to reduce output

```bash
#!/bin/bash

# Check if anatomy files changed
anatomy_files=$(git diff --cached --name-only | grep -E "^(src/anatomy|data/mods/anatomy|data/schemas/anatomy)")

if [ -z "$anatomy_files" ]; then
  echo "⏭️  No anatomy files changed, skipping validation"
  exit 0
fi

# Run validation only if anatomy files changed
npm run validate:body-descriptors --silent
# ...
```

## Files to Create

- `scripts/install-git-hooks.js` (NEW)
  - Hook installation script

- `.git/hooks/pre-commit` (CREATED BY SCRIPT)
  - Actual Git hook (not committed to repo)

## Files to Modify

- `package.json` (MODIFY)
  - Add `install-hooks` script
  - Optionally add to `postinstall`

- `README.md` (MODIFY)
  - Document hook installation
  - Document bypass mechanism

- `.gitignore` (VERIFY)
  - Ensure `.git/hooks/` not ignored (it's not by default)

### Package.json Changes

```json
{
  "scripts": {
    "install-hooks": "node scripts/install-git-hooks.js",
    "postinstall": "npm run install-hooks"
  }
}
```

### README.md Section

```markdown
## Git Hooks

### Pre-commit Hook

The project includes a pre-commit hook that validates body descriptor consistency.

#### Installation

```bash
npm run install-hooks
```

The hook automatically runs:
1. Body descriptor validation
2. Consistency tests

#### Bypassing the Hook

For emergencies only:

```bash
git commit --no-verify
```

**Note**: Use bypass sparingly. Invalid commits may break the build.

#### Troubleshooting

If the hook fails:
1. Run validation manually: `npm run validate:body-descriptors`
2. Fix reported errors
3. Run tests: `npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js`
4. Retry commit
```

## Testing Requirements

### Manual Testing

1. **Install Hook**
   ```bash
   npm run install-hooks
   ```

2. **Test Valid Commit**
   - Make valid change to anatomy file
   - Commit should succeed
   - Validation messages should appear

3. **Test Invalid Commit**
   - Make invalid change (remove descriptor from config)
   - Commit should fail
   - Clear error message should appear

4. **Test Bypass**
   - With invalid change
   - Use `git commit --no-verify`
   - Commit should succeed with warning

5. **Test Non-Anatomy Commit**
   - Change unrelated file
   - Should skip validation (if filter implemented)
   - Commit should be fast

### Automated Testing

Test installation script:

```javascript
// tests/unit/scripts/installGitHooks.test.js

describe('Git Hook Installation', () => {
  it('should create pre-commit hook file', () => {
    // Test hook creation
  });

  it('should set executable permissions', () => {
    // Test permissions
  });

  it('should handle missing .git directory gracefully', () => {
    // Test error handling
  });
});
```

## Success Criteria

- [ ] Installation script works correctly
- [ ] Hook is created with correct permissions
- [ ] Hook runs validation on commit
- [ ] Hook blocks invalid commits
- [ ] Hook shows clear error messages
- [ ] Bypass mechanism works
- [ ] Performance is acceptable (< 10 seconds)
- [ ] Documentation is clear
- [ ] Works on all platforms (Linux, macOS, Windows)

## Platform Compatibility

### Linux/macOS
- Bash script works natively
- No special handling needed

### Windows
- Git Bash executes hook correctly
- Test on Windows to ensure compatibility
- Consider providing `.bat` alternative if needed

## Related Tickets

- Depends on: BODDESROB-007 (CLI Validation Tool)
- Depends on: BODDESROB-009 (Schema Consistency Tests)
- Related to: Spec Section 4.5 "Phase 5: Add Pre-commit Hook"

## Configuration Options

### Optional Features

1. **File Filtering**
   - Only run validation if anatomy files changed
   - Speeds up commits for unrelated changes

2. **Configurable Checks**
   - Allow disabling specific checks via config
   - Example: `.body-descriptor-validation.json`

3. **Skip on WIP Commits**
   - Skip validation for WIP commits
   - Re-validate on push

4. **Custom Validation Scripts**
   - Allow adding custom validators
   - Extensibility for future checks

### Configuration File Example

```json
// .body-descriptor-validation.json (optional)
{
  "preCommit": {
    "enabled": true,
    "runOnlyIfAnatomyFilesChanged": true,
    "checks": {
      "validationTool": true,
      "consistencyTests": true
    },
    "skipOnWip": false
  }
}
```

## Bypass Documentation

### When to Bypass

- Emergency hotfix
- Work in progress (WIP) commits
- Experimental branches
- Known issues being debugged

### How to Bypass

```bash
# Single commit
git commit --no-verify

# Disable temporarily
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# Re-enable
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

### Bypass Warning

Include in hook output:

```
⚠️  CAUTION: Using --no-verify bypasses validation
   Invalid commits may break the build
   Use only for emergencies
```

## Notes

- Keep hook fast - developers will disable slow hooks
- Clear error messages are critical
- Make bypass easy but documented
- Consider making hook optional (not forced on all developers)
- Test on all platforms before deploying
- Document all edge cases
- Provide troubleshooting guide
- Consider adding to onboarding documentation
