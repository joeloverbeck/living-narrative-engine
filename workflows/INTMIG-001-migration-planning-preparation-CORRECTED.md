# INTMIG-001: Migration Planning and Preparation (CORRECTED)

## Overview

Establish comprehensive infrastructure and validation systems for migrating 24 intimacy mod actions from the legacy `scope` format to the new `targets` format. This ticket sets up all necessary tooling, tracking systems, and validation procedures to ensure a smooth, reversible migration process.

## Priority

**HIGH** - Foundation ticket that must be completed before any migration work begins

## Dependencies

- **Blocked by**: None (this is the starting point)
- **Enables**: INTMIG-002 through INTMIG-005 (migration batches)
- **Related**: specs/intimacy-actions-multi-target-migration.spec.md

## Acceptance Criteria

- [ ] Migration tracking spreadsheet/checklist created with all 24 actions
- [ ] Action tracing configuration set up for migration validation
- [ ] Required directories created (backups/, traces/, test-baselines/)
- [ ] Backup of all original action files created
- [ ] Migration validation script created and tested
- [ ] Rollback script created and tested
- [ ] Pre-migration baseline tests captured
- [ ] Migration environment variables configured
- [ ] Team communication plan established
- [ ] Risk assessment document completed
- [ ] Success metrics defined and measurable

## Implementation Steps

### Step 1: Create Migration Tracking System

**1.1 Create tracking document**

Create `workflows/INTMIG-tracking.md` with the following structure:

```markdown
# INTMIG Migration Tracking

## Migration Status

| Action ID                      | File Path                                                    | Current Format | Migration Status | Validated | Tests Pass | Notes |
| ------------------------------ | ------------------------------------------------------------ | -------------- | ---------------- | --------- | ---------- | ----- |
| intimacy:accept_kiss_passively | data/mods/intimacy/actions/accept_kiss_passively.action.json | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:break_kiss_gently     | data/mods/intimacy/actions/break_kiss_gently.action.json     | scope          | ❌ Not Started   | ❌        | ❌         |       |

[... continue for all 24 actions ...]

## Validation Checklist

- [ ] All 24 actions migrated
- [ ] No files contain both scope and targets
- [ ] Schema validation passes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass

## Rollback Log

| Date | Action | Reason | Restored From |
| ---- | ------ | ------ | ------------- |
```

### Step 2: Create Required Directories

**2.1 Create directory structure**

```bash
mkdir -p backups
mkdir -p traces/intmig-migration
mkdir -p test-baselines
```

### Step 3: Configure Action Tracing

**3.1 Update trace configuration file**

Update `config/trace-config.json` to enable action tracing for intimacy actions:

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["intimacy:*"],
    "outputDirectory": "./traces/intmig-migration",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 1000,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
  // ... rest of existing configuration
}
```

**3.2 Create trace validation script**

Create `scripts/validate-action-traces.js`:

```javascript
#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const TRACE_DIR = './traces/intmig-migration';
const EXPECTED_ACTIONS = [
  'intimacy:accept_kiss_passively',
  'intimacy:break_kiss_gently',
  'intimacy:brush_hand',
  'intimacy:cup_face_while_kissing',
  'intimacy:explore_mouth_with_tongue',
  'intimacy:feel_arm_muscles',
  'intimacy:fondle_ass',
  'intimacy:kiss_back_passionately',
  'intimacy:kiss_cheek',
  'intimacy:kiss_neck_sensually',
  'intimacy:lean_in_for_deep_kiss',
  'intimacy:lick_lips',
  'intimacy:massage_back',
  'intimacy:massage_shoulders',
  'intimacy:nibble_earlobe_playfully',
  'intimacy:nibble_lower_lip',
  'intimacy:nuzzle_face_into_neck',
  'intimacy:peck_on_lips',
  'intimacy:place_hand_on_waist',
  'intimacy:pull_back_breathlessly',
  'intimacy:pull_back_in_revulsion',
  'intimacy:suck_on_neck_to_leave_hickey',
  'intimacy:suck_on_tongue',
  'intimacy:thumb_wipe_cheek',
];

async function validateTraces() {
  // Check if trace directory exists
  try {
    await fs.access(TRACE_DIR);
  } catch {
    console.error(`Trace directory does not exist: ${TRACE_DIR}`);
    console.log('No traces to validate yet.');
    return;
  }

  const traceFiles = await fs.readdir(TRACE_DIR);
  const tracedActions = new Set();

  for (const file of traceFiles) {
    const trace = JSON.parse(
      await fs.readFile(path.join(TRACE_DIR, file), 'utf8')
    );
    tracedActions.add(trace.actionId);

    // Validate trace structure
    if (!trace.timestamp || !trace.actionId || !trace.eventPayload) {
      console.error(`Invalid trace structure in ${file}`);
      process.exit(1);
    }
  }

  // Check all actions were traced
  const missing = EXPECTED_ACTIONS.filter((a) => !tracedActions.has(a));
  if (missing.length > 0) {
    console.error('Missing traces for:', missing);
    process.exit(1);
  }

  console.log('✅ All action traces validated successfully');
}

validateTraces().catch(console.error);
```

### Step 4: Create Backup System

**4.1 Create backup script**

Create `scripts/backup-intimacy-actions.sh`:

```bash
#!/bin/bash
set -e

# Create backups directory if it doesn't exist
mkdir -p backups

BACKUP_DIR="backups/intmig-$(date +%Y%m%d-%H%M%S)"
SOURCE_DIR="data/mods/intimacy/actions"

echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo "Backing up action files..."
cp -r "$SOURCE_DIR" "$BACKUP_DIR/"

echo "Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$SOURCE_DIR",
  "fileCount": $(ls -1 "$SOURCE_DIR"/*.action.json | wc -l),
  "migration": "INTMIG",
  "gitCommit": "$(git rev-parse HEAD)"
}
EOF

echo "Verifying backup..."
if [ $(ls -1 "$BACKUP_DIR/actions"/*.action.json | wc -l) -eq 25 ]; then
  echo "✅ Backup completed successfully at $BACKUP_DIR"
else
  echo "❌ Backup verification failed!"
  exit 1
fi
```

**4.2 Make script executable**

```bash
chmod +x scripts/backup-intimacy-actions.sh
```

### Step 5: Create Migration Validation Script

**5.1 Create comprehensive validation script**

Create `scripts/validate-intmig-migration.js` (following existing pattern from validate-scopes-migration.js):

```javascript
#!/usr/bin/env node

/**
 * @file Validates intimacy actions migration from scope to targets
 * @description Ensures all intimacy actions have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ACTIONS_DIR = 'data/mods/intimacy/actions';
const SCHEMA_PATH = 'data/schemas/action.schema.json';

// Expected migrations (all except adjust_clothing which doesn't need migration)
const ACTIONS_TO_MIGRATE = [
  'accept_kiss_passively',
  'break_kiss_gently',
  'brush_hand',
  'cup_face_while_kissing',
  'explore_mouth_with_tongue',
  'feel_arm_muscles',
  'fondle_ass',
  'kiss_back_passionately',
  'kiss_cheek',
  'kiss_neck_sensually',
  'lean_in_for_deep_kiss',
  'lick_lips',
  'massage_back',
  'massage_shoulders',
  'nibble_earlobe_playfully',
  'nibble_lower_lip',
  'nuzzle_face_into_neck',
  'peck_on_lips',
  'place_hand_on_waist',
  'pull_back_breathlessly',
  'pull_back_in_revulsion',
  'suck_on_neck_to_leave_hickey',
  'suck_on_tongue',
  'thumb_wipe_cheek',
];

async function validateMigration() {
  console.log('🔍 Validating intimacy actions migration...\n');

  const ajv = new Ajv({ allErrors: true, verbose: true });

  // Load action schema
  const actionSchema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  const validate = ajv.compile(actionSchema);

  const results = {
    total: 0,
    migrated: 0,
    valid: 0,
    errors: [],
  };

  for (const actionName of ACTIONS_TO_MIGRATE) {
    const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
    results.total++;

    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

      // Check migration status
      if (content.scope) {
        results.errors.push({
          action: actionName,
          error: 'Still using legacy "scope" format',
        });
        continue;
      }

      if (!content.targets) {
        results.errors.push({
          action: actionName,
          error: 'Missing "targets" property',
        });
        continue;
      }

      // Check for both properties (invalid state)
      if (content.scope && content.targets) {
        results.errors.push({
          action: actionName,
          error: 'Contains both "scope" and "targets" (invalid)',
        });
        continue;
      }

      results.migrated++;

      // Validate against schema
      if (validate(content)) {
        results.valid++;
      } else {
        results.errors.push({
          action: actionName,
          error: 'Schema validation failed',
          details: validate.errors,
        });
      }
    } catch (err) {
      results.errors.push({
        action: actionName,
        error: `Failed to process: ${err.message}`,
      });
    }
  }

  // Report results
  console.log('=== INTMIG Migration Validation Report ===\n');
  console.log(`Total actions to migrate: ${results.total}`);
  console.log(`Successfully migrated: ${results.migrated}`);
  console.log(`Schema valid: ${results.valid}`);
  console.log(`Errors found: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n=== Errors ===\n');
    for (const error of results.errors) {
      console.log(`❌ ${error.action}: ${error.error}`);
      if (error.details) {
        console.log('  Details:', JSON.stringify(error.details, null, 2));
      }
    }
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 6: Create Rollback Script

**6.1 Create rollback script**

Create `scripts/rollback-intmig-migration.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-directory>"
  echo "Available backups:"
  ls -la backups/intmig-* 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_DIR="$1"
TARGET_DIR="data/mods/intimacy/actions"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Backup directory not found: $BACKUP_DIR"
  exit 1
fi

echo "⚠️  WARNING: This will restore intimacy actions from backup"
echo "Backup: $BACKUP_DIR"
echo "Target: $TARGET_DIR"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Rollback cancelled"
  exit 0
fi

echo "Creating safety backup of current state..."
mkdir -p backups
SAFETY_BACKUP="backups/intmig-rollback-safety-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SAFETY_BACKUP"
cp -r "$TARGET_DIR" "$SAFETY_BACKUP/"

echo "Restoring from backup..."
cp -r "$BACKUP_DIR/actions/"*.action.json "$TARGET_DIR/"

echo "Verifying restoration..."
node scripts/validate-intmig-migration.js || true

echo "✅ Rollback completed from $BACKUP_DIR"
echo "Safety backup created at: $SAFETY_BACKUP"
```

### Step 7: Capture Baseline Tests

**7.1 Create test baseline script**

Create `scripts/capture-test-baseline.sh`:

```bash
#!/bin/bash
set -e

# Create test-baselines directory if it doesn't exist
mkdir -p test-baselines

BASELINE_DIR="test-baselines/intmig-$(date +%Y%m%d-%H%M%S)"

echo "Creating baseline directory: $BASELINE_DIR"
mkdir -p "$BASELINE_DIR"

echo "Running unit tests..."
npm run test:unit 2>&1 | tee "$BASELINE_DIR/unit-tests.log"

echo "Running integration tests..."
npm run test:integration 2>&1 | tee "$BASELINE_DIR/integration-tests.log"

echo "Running E2E tests..."
npm run test:e2e 2>&1 | tee "$BASELINE_DIR/e2e-tests.log"

echo "Capturing test coverage..."
npm run test:ci 2>&1 | tee "$BASELINE_DIR/coverage.log"

echo "Creating baseline summary..."
cat > "$BASELINE_DIR/summary.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse HEAD)",
  "gitBranch": "$(git branch --show-current)",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF

echo "✅ Test baseline captured at: $BASELINE_DIR"
```

### Step 8: Define Success Metrics

**8.1 Create metrics definition**

Create `workflows/INTMIG-metrics.md`:

````markdown
# INTMIG Success Metrics

## Quantitative Metrics

### Migration Completion

- ✅ 24/24 actions migrated from `scope` to `targets`
- ✅ 0 files containing both `scope` and `targets`
- ✅ 100% schema validation pass rate

### Test Coverage

- ✅ 100% unit test pass rate (no regressions)
- ✅ 100% integration test pass rate (no regressions)
- ✅ 100% E2E test pass rate (no regressions)
- ✅ Code coverage maintained or improved

### Performance

- ✅ Action discovery time ≤ baseline
- ✅ Action execution time ≤ baseline
- ✅ Memory usage ≤ baseline + 5%

### Quality

- ✅ 0 ESLint errors introduced
- ✅ 0 TypeScript errors introduced
- ✅ All action traces validate correctly

## Qualitative Metrics

### Code Quality

- ✅ Consistent format across all migrated files
- ✅ Clear git history with atomic commits
- ✅ Comprehensive documentation updates

### Risk Management

- ✅ Rollback tested and verified
- ✅ No production issues during migration
- ✅ Clear communication to team

## Measurement Commands

```bash
# Validate migration
node scripts/validate-intmig-migration.js

# Run tests
npm run test:ci

# Check linting
npm run lint

# Validate traces (if action tracing enabled)
node scripts/validate-action-traces.js
```
````

````

## Testing Requirements

### Pre-Migration Testing
1. Create required directories:
   ```bash
   mkdir -p backups traces/intmig-migration test-baselines
````

2. Run full test suite and capture baseline:

   ```bash
   ./scripts/capture-test-baseline.sh
   ```

3. Verify all tests pass:
   ```bash
   npm run test:ci
   ```

### Migration Validation Testing

1. After each batch migration, run:

   ```bash
   node scripts/validate-intmig-migration.js
   npm run test:unit -- --testPathPattern=intimacy
   ```

2. Run linting to verify no issues:
   ```bash
   npm run lint
   ```

### Post-Migration Testing

1. Full regression test:

   ```bash
   npm run test:ci
   ```

2. Performance comparison with baseline
3. Action trace analysis (if enabled)

## Risk Mitigation

### Identified Risks

| Risk                           | Probability | Impact | Mitigation                                         |
| ------------------------------ | ----------- | ------ | -------------------------------------------------- |
| Test failures after migration  | Medium      | High   | Run tests after each batch, rollback if needed     |
| Schema validation errors       | Low         | Medium | Validate each file immediately after migration     |
| Rule incompatibility           | Low         | High   | Test rules with migrated actions before proceeding |
| Performance degradation        | Low         | Medium | Benchmark after each batch                         |
| Git conflicts during migration | Medium      | Low    | Work on dedicated branch, frequent commits         |
| Missed edge cases              | Low         | High   | Comprehensive test coverage, action tracing        |

### Rollback Procedures

1. **Immediate Rollback** (during migration):

   ```bash
   git checkout -- data/mods/intimacy/actions/
   ```

2. **Backup Restoration** (after commit):

   ```bash
   ./scripts/rollback-intmig-migration.sh backups/intmig-[timestamp]
   ```

3. **Git Revert** (after merge):
   ```bash
   git revert [commit-hash]
   ```

## Documentation Updates

### Files to Update

- [ ] `workflows/INTMIG-tracking.md` - Create and maintain
- [ ] `CHANGELOG.md` - Add migration entry after completion
- [ ] `docs/migration-guide.md` - Document migration pattern for future use

### Developer Communication

- [ ] Team notification before starting migration
- [ ] Progress updates after each batch
- [ ] Completion announcement with metrics

## Execution Commands

```bash
# 1. Create required directories
mkdir -p backups traces/intmig-migration test-baselines

# 2. Create backup
./scripts/backup-intimacy-actions.sh

# 3. Capture test baseline
./scripts/capture-test-baseline.sh

# 4. Update trace configuration (manually edit config/trace-config.json if needed)
# Note: Action tracing is optional but recommended for debugging

# 5. Validate setup
node scripts/validate-intmig-migration.js

# 6. Proceed to INTMIG-002 through INTMIG-005
```

## Completion Checklist

- [ ] All required directories created
- [ ] All scripts created and tested
- [ ] Backup system verified
- [ ] Rollback tested with dummy file
- [ ] Test baseline captured
- [ ] Action tracing configured (optional)
- [ ] Migration tracking document created
- [ ] Success metrics defined
- [ ] Team notified of migration plan
- [ ] Risk assessment reviewed
- [ ] Ready to proceed with batch migrations

## Notes

- This preparation phase is critical for migration success
- All scripts should be tested before actual migration
- Keep backup for at least 30 days after successful migration
- Document any deviations from plan in tracking document
- Reference existing migration scripts (validate-scopes-migration.js, etc.) for patterns
