# JSOSCHVALROB-004: Create Operation Type Validation Script

## Status

✅ **COMPLETED**

## Objective

Create npm script and validation tool to ensure `KNOWN_OPERATION_TYPES` whitelist remains synchronized with registered operation handlers, preventing "Unknown operation type" errors.

## Corrected Assumptions

### Initial Assumptions (Incorrect)

- ❌ Assumed `createContainer()` function exists and can be directly called
- ❌ Assumed DI container could be used in script context
- ❌ Assumed `registry.getAllTypes()` method exists
- ❌ Assumed container provides direct access to OperationRegistry

### Actual Implementation (Correct)

- ✅ No `createContainer()` - container is configured via `configureContainer()` with UI dependencies
- ✅ `OperationRegistry.getRegisteredTypes()` method exists (not `getAllTypes()`)
- ✅ Script must parse source files directly using regex/AST
- ✅ Similar pattern exists in `scripts/validateOperations.js`

## Ticket Scope

### What This Ticket WILL Do

- Create new validation script `scripts/validateOperationTypes.js`
- Add npm script `npm run validate:operation-types`
- Verify all registered handlers have whitelist entries
- Verify all whitelist entries have registered handlers
- Verify whitelist maintains alphabetical order
- Exit with error code 1 on validation failures
- Parse source files directly (no DI container usage)

### What This Ticket WILL NOT Do

- Modify `KNOWN_OPERATION_TYPES` array in `preValidationUtils.js`
- Change operation handler registration logic
- Update operation handler implementations
- Add or remove operation types (only validate existing)
- Modify schema files or validation logic
- Use DI container (parse files instead)

## Files to Touch

### New Files (1)

- `scripts/validateOperationTypes.js` - NEW validation script

### Modified Files (1)

- `package.json` - Add `validate:operation-types` script

### Files to Read (for context)

- `src/utils/preValidationUtils.js` - Read `KNOWN_OPERATION_TYPES` array
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Parse registered handlers
- `scripts/validateOperations.js` - Reference implementation pattern

## Implementation Approach

### Corrected Script Structure

```javascript
#!/usr/bin/env node
/**
 * @file Validates synchronization between KNOWN_OPERATION_TYPES whitelist
 * and registered operation handlers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('🔍 Validating operation type synchronization...\n');

  // 1. Extract KNOWN_OPERATION_TYPES from preValidationUtils.js
  const whitelistTypes = extractWhitelistTypes();

  // 2. Extract registered types from interpreterRegistrations.js
  const registeredTypes = extractRegisteredTypes();

  // 3. Check whitelist completeness
  const missingFromWhitelist = checkMissingFromWhitelist(
    registeredTypes,
    whitelistTypes
  );
  const orphanedInWhitelist = checkOrphanedInWhitelist(
    whitelistTypes,
    registeredTypes
  );

  // 4. Check alphabetical order
  const sortingIssue = checkAlphabeticalOrder(whitelistTypes);

  // 5. Report results
  reportResults(
    missingFromWhitelist,
    orphanedInWhitelist,
    sortingIssue,
    whitelistTypes.length,
    registeredTypes.length
  );
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
```

### File Parsing Functions

```javascript
/**
 * Extract KNOWN_OPERATION_TYPES from preValidationUtils.js
 */
function extractWhitelistTypes() {
  const preValidationPath = path.join(
    projectRoot,
    'src/utils/preValidationUtils.js'
  );
  const content = fs.readFileSync(preValidationPath, 'utf8');

  const whitelistMatch = content.match(
    /export const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/
  );
  const types = [];

  if (whitelistMatch) {
    const whitelistBody = whitelistMatch[1];
    const matches = whitelistBody.matchAll(/'([^']+)'/g);
    for (const match of matches) {
      types.push(match[1]);
    }
  }

  return types;
}

/**
 * Extract registered types from interpreterRegistrations.js
 */
function extractRegisteredTypes() {
  const interpreterPath = path.join(
    projectRoot,
    'src/dependencyInjection/registrations/interpreterRegistrations.js'
  );
  const content = fs.readFileSync(interpreterPath, 'utf8');

  const types = [];
  const mappingMatches = content.matchAll(
    /registry\.register\(\s*['"]([A-Z_]+)['"]\s*,\s*bind\(tokens\.\w+\)/gs
  );

  for (const match of mappingMatches) {
    types.push(match[1]);
  }

  return types.sort();
}
```

## Acceptance Criteria

### Script Must Detect

#### Issue 1: Missing Whitelist Entry

```javascript
// Scenario: Handler registered but not in KNOWN_OPERATION_TYPES
// Expected Output:
❌ Missing from whitelist: NEW_OPERATION
// Exit Code: 1
```

#### Issue 2: Orphaned Whitelist Entry

```javascript
// Scenario: Type in whitelist but no handler registered
// Expected Output:
❌ Whitelisted but no handler: OLD_OPERATION
// Exit Code: 1
```

#### Issue 3: Unsorted Whitelist

```javascript
// Scenario: Whitelist not in alphabetical order
// Expected Output:
❌ Whitelist not alphabetically sorted
Expected order:
  ADD_COMPONENT
  MODIFY_COMPONENT
  QUERY_COMPONENT
// Exit Code: 1
```

### Script Must Pass

#### Success Case: All Synchronized

```javascript
// Expected Output:
✅ All 62 operation types validated
✅ Whitelist synchronized with registered handlers
✅ Whitelist alphabetically sorted
// Exit Code: 0
```

## Definition of Done

- [x] New script created at `scripts/validateOperationTypes.js`
- [x] Script has executable permissions (`chmod +x`)
- [x] npm script added to `package.json`
- [x] Script detects all 3 issue types (missing, orphaned, unsorted)
- [x] Script exits 0 on success, 1 on failure
- [x] Script output is clear and actionable
- [x] No changes to source code files
- [x] Script runs successfully in current state (all validations pass)
- [x] Script is deterministic (same output on repeated runs)

## Outcome

### What Was Actually Changed vs Originally Planned

**Changes Made:**

1. ✅ Created `scripts/validateOperationTypes.js` with file parsing approach (not DI container)
2. ✅ Added `validate:operation-types` npm script to package.json
3. ✅ Script validates whitelist-handler synchronization
4. ✅ Script validates alphabetical ordering
5. ✅ Script provides clear, actionable error messages

**Deviations from Original Plan:**

1. **Architecture**: Used file parsing instead of DI container (DI requires UI context)
2. **Method Name**: Used actual method name `getRegisteredTypes()` (not `getAllTypes()`)
3. **Pattern**: Followed existing `validateOperations.js` pattern for consistency

**Why Changes Were Necessary:**

- DI container cannot be instantiated in script context (requires UI dependencies)
- File parsing is simpler, faster, and doesn't require runtime dependencies
- Maintains consistency with existing validation scripts in the project

## Verification Commands

```bash
# Run validation script directly
node scripts/validateOperationTypes.js

# Run via npm script
npm run validate:operation-types

# Verify no source changes
git diff src/
```

## Related Documentation

- Spec: `specs/json-schema-validation-robustness.md` (lines 1351-1466)
- CLAUDE.md: Operation registration checklist (lines 421-504)
- Pre-validation: `src/utils/preValidationUtils.js` (lines 32-94)
- Registration: `src/dependencyInjection/registrations/interpreterRegistrations.js`
- Reference: `scripts/validateOperations.js` (comprehensive validation)
