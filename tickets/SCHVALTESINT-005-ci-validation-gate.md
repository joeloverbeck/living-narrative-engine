# SCHVALTESINT-005: Add Validation Gate Job to CI Workflow

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: 2 - CI Validation Gate
**Dependencies**: None
**Blocks**: None (parallel to other tickets)

---

## Objective

Add a `validation-gate` job to the GitHub Actions CI workflow that runs schema validation before any test jobs execute, ensuring PRs with validation failures are rejected early.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `.github/workflows/tests.yml` | Add validation-gate job and dependencies |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `package.json` | Verify validate:strict and validate:operations scripts exist |

---

## Out of Scope

**DO NOT MODIFY:**

- Any source code files in `src/`
- Any test files in `tests/`
- Any schema files in `data/schemas/`
- The `npm run validate:strict` or `npm run validate:operations` implementations
- Other workflow files

**DO NOT:**

- Add new npm scripts (use existing validation scripts)
- Change test execution behavior
- Add new dependencies
- Modify matrix strategies for test jobs

---

## Implementation Details

### Current Workflow Structure (Problem)

```yaml
# .github/workflows/tests.yml (current - approximate)

jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit
      # ⚠️ No validation before tests run

  test-integration:
    runs-on: ubuntu-latest
    steps:
      # ⚠️ Same problem - tests run without prior validation
```

### Required Changes

1. **Add `validation-gate` job** that runs first
2. **Run `npm run validate:strict`** to validate all schemas and mod files
3. **Run `npm run validate:operations`** to verify operation type registration
4. **Make all test jobs depend** on `validation-gate` passing
5. **Add clear failure messages** for validation errors

### Suggested Implementation

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validation-gate:
    name: Schema & Mod Validation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate schemas (strict mode)
        run: npm run validate:strict

      - name: Validate operation registrations
        run: npm run validate:operations

      - name: Schema validation summary
        if: success()
        run: echo "✅ All schemas and operations validated successfully"

  test-unit:
    name: Unit Tests
    needs: [validation-gate]  # ← Depends on validation passing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit

  test-integration:
    name: Integration Tests
    needs: [validation-gate]  # ← Depends on validation passing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  test-e2e:
    name: E2E Tests
    needs: [validation-gate]  # ← Depends on validation passing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Existing CI workflow** continues to run all tests on valid PRs
2. **validation-gate job** blocks test execution on schema failures
3. **All test jobs** declare dependency on `validation-gate`

### Manual Verification Steps

1. **Verify scripts exist**: Run locally
   ```bash
   npm run validate:strict
   npm run validate:operations
   ```
   Both should pass on current main branch.

2. **Test failure blocking**:
   - Create branch with intentionally invalid schema
   - Push to GitHub
   - Verify `validation-gate` fails
   - Verify test jobs show "skipped" (blocked by dependency)

3. **Test success flow**:
   - Create branch with valid changes
   - Push to GitHub
   - Verify `validation-gate` passes
   - Verify test jobs run after validation

### Invariants That Must Remain True

1. **INV-4 (CI Validation Gate)**: After this change, PRs with invalid schemas fail before tests run
2. **Test Independence**: Test jobs still run independently of each other (parallel)
3. **Clear Feedback**: Validation failures show clear error messages in CI logs
4. **No Test Skipping**: All test jobs still run when validation passes

### CI Behavior Matrix

| Validation Result | Test Jobs Run? | PR Status |
|-------------------|----------------|-----------|
| All validations pass | Yes (all) | Based on test results |
| validate:strict fails | No (skipped) | Failed at validation-gate |
| validate:operations fails | No (skipped) | Failed at validation-gate |
| Validation passes, tests fail | Yes (ran) | Failed at test job |

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - standard GitHub Actions workflow modification
- **Risk**: Low - additive change, doesn't modify test behavior

## Review Checklist

- [ ] `validation-gate` job runs before all test jobs
- [ ] All test jobs declare `needs: [validation-gate]`
- [ ] `npm run validate:strict` command is correct
- [ ] `npm run validate:operations` command is correct (verify script exists)
- [ ] Node.js version matches other jobs
- [ ] Caching configured for npm
- [ ] CI passes on main branch after merge
