# OPEHANIMP-009: Integrate Operation Validation into CI Pipeline

**Priority**: High
**Effort**: Low
**Phase**: 2 (Week 2)
**Dependencies**: OPEHANIMP-008

## Objective

Integrate the operation validation script into the CI pipeline and optionally add as a pre-commit hook to catch registration issues before they reach the repository.

## Background

Even with validation scripts, developers may forget to run them manually. Integration into CI and pre-commit hooks ensures:
- No broken registrations reach the main branch
- Immediate feedback during development
- Enforced quality standards
- Reduced CI failures from simple mistakes

## Requirements

### 1. CI Pipeline Integration

**File**: `package.json`

Update test scripts to include operation validation:

```json
{
  "scripts": {
    "test:ci": "npm run validate:operations && npm run lint && npm run typecheck && npm run test:unit && npm run test:integration",
    "test:quick": "npm run validate:operations && npm run typecheck",
    "validate:all": "npm run validate:schemas && npm run validate:operations && npm run typecheck"
  }
}
```

### 2. Pre-commit Hook Setup (Optional)

**File**: `.husky/pre-commit` (if using Husky)

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run quick validations before commit
echo "🔍 Running pre-commit validations..."

# Validate operations
npm run validate:operations || exit 1

# Validate schemas
npm run validate:schemas || exit 1

# Type check
npm run typecheck || exit 1

# Lint staged files
npx lint-staged || exit 1

echo "✅ Pre-commit validations passed"
```

**Configuration**: `.lintstagedrc.json`

```json
{
  "*.js": [
    "eslint --fix",
    "git add"
  ],
  "data/schemas/**/*.json": [
    "npm run validate:schemas"
  ],
  "src/logic/operationHandlers/**/*.js": [
    "npm run validate:operations"
  ]
}
```

### 3. GitHub Actions Workflow (if using GitHub)

**File**: `.github/workflows/validate-operations.yml`

```yaml
name: Validate Operations

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/logic/operationHandlers/**'
      - 'data/schemas/operations/**'
      - 'src/dependencyInjection/**'
      - 'src/utils/preValidationUtils.js'
  pull_request:
    branches: [ main, develop ]
    paths:
      - 'src/logic/operationHandlers/**'
      - 'data/schemas/operations/**'
      - 'src/dependencyInjection/**'
      - 'src/utils/preValidationUtils.js'

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Validate operation registrations
      run: npm run validate:operations

    - name: Validate schemas
      run: npm run validate:schemas

    - name: Type check
      run: npm run typecheck
```

### 4. VS Code Task Integration

**File**: `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate Operations",
      "type": "npm",
      "script": "validate:operations",
      "problemMatcher": [],
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "group": {
        "kind": "test",
        "isDefault": false
      }
    },
    {
      "label": "Validate All",
      "type": "npm",
      "script": "validate:all",
      "problemMatcher": [],
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "group": {
        "kind": "test",
        "isDefault": false
      }
    }
  ]
}
```

### 5. Documentation Updates

**Add to README.md**:

```markdown
## Validation

The project includes automated validation scripts to ensure code quality:

### Operation Handler Validation

Validates that all operation handlers are properly registered:

```bash
npm run validate:operations
```

This checks:
- Schema files are referenced
- Operations are in pre-validation whitelist
- Tokens are defined
- Handlers are registered
- Operations are mapped
- Handler files exist

### Pre-commit Hooks

The project uses Husky for pre-commit validation. Install with:

```bash
npm run prepare  # Sets up Git hooks
```

This will run validations automatically before each commit.

### CI Pipeline

All validations run automatically in CI:
- On push to main/develop branches
- On pull requests
- On files in operation-related paths

### Manual Validation

Run all validations:

```bash
npm run validate:all
```

Run quick validations:

```bash
npm run test:quick
```
```

**Add to CLAUDE.md**:

```markdown
### Operation Validation

**Always run before committing changes to operation handlers:**

```bash
npm run validate:operations  # Validate operation registrations
npm run validate:all         # Run all validations
```

These validations are also enforced in CI.
```

**Add to docs/adding-operations.md**:

```markdown
## Validation in CI

Operation validation runs automatically in CI when you:
- Push to main or develop branch
- Open a pull request
- Modify files in operation-related paths

### Pre-commit Validation

To enable pre-commit validation locally:

```bash
npm run prepare
```

This installs Git hooks that run validation before each commit.

### Disabling Pre-commit Hooks (Not Recommended)

If you need to commit work-in-progress:

```bash
git commit --no-verify -m "WIP: operation handler"
```

**Warning**: CI will still fail if validations don't pass.
```

## Acceptance Criteria

- [ ] `validate:operations` integrated into `test:ci` script
- [ ] Pre-commit hook setup (if using Husky)
- [ ] GitHub Actions workflow created (if using GitHub)
- [ ] VS Code tasks configured
- [ ] README.md updated with validation instructions
- [ ] CLAUDE.md updated with validation commands
- [ ] docs/adding-operations.md updated with CI information
- [ ] All team members can run validations locally
- [ ] CI fails appropriately when validations fail
- [ ] Clear error messages in CI logs

## Testing

### Local Testing

1. Make a change that breaks validation
2. Try to commit (should be blocked by pre-commit hook)
3. Fix the issue
4. Commit should succeed

### CI Testing

1. Create branch with invalid registration
2. Push to branch
3. Verify CI fails with clear error message
4. Fix registration
5. Push again
6. Verify CI passes

### Integration Testing

1. Walk through full development cycle:
   - Create new operation with CLI tool
   - Validation passes locally
   - Commit (pre-commit hook passes)
   - Push (CI passes)
2. Verify all steps work smoothly

## Implementation Notes

### Husky Setup

If not already using Husky:

```bash
npm install --save-dev husky lint-staged
npm set-script prepare "husky install"
npm run prepare
npx husky add .husky/pre-commit "npm run validate:operations"
```

### Performance Considerations

- Validation script should complete in <5 seconds
- Pre-commit hooks should not significantly slow down commits
- Consider making pre-commit hooks optional for large teams

### Alternative: Git Pre-commit (without Husky)

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/sh

echo "🔍 Running pre-commit validations..."

npm run validate:operations || exit 1

echo "✅ Validations passed"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

**Note**: This requires manual setup on each clone

## Time Estimate

4-6 hours (including documentation and testing)

## Related Tickets

- OPEHANIMP-008: Build-time validation script (dependency)
- OPEHANIMP-007: CLI scaffolding tool (integration point)

## Success Metrics

- Zero broken registrations reach main branch
- CI catches all registration issues
- Pre-commit hooks provide immediate feedback
- Development workflow not significantly slowed
- Team adoption of validation practices
