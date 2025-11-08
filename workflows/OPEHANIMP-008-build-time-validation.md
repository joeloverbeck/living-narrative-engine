# OPEHANIMP-008: Create Build-Time Validation Script (npm run validate:operations)

**Priority**: High
**Effort**: Medium
**Phase**: 2 (Week 2)
**Dependencies**: None

## Objective

Create a comprehensive validation script that checks operation handler registration completeness across all files, catching missing registrations before runtime.

## Background

Currently, missing registrations are only detected at runtime or during integration tests. This leads to:
- Long feedback loops
- Wasted debugging time
- Broken builds reaching CI

A build-time validation script will:
- Detect issues in <5 seconds
- Provide specific error messages
- Prevent broken code from being committed
- Serve as documentation of what's registered

## Actual Codebase Structure (Validated 2025-11-08)

Based on analysis of the current codebase, the operation handler system has the following structure:

**Schema Organization**:
- Main schema: `data/schemas/operation.schema.json` (NOT in operations/ subdirectory)
- Operation schemas: `data/schemas/operations/*.schema.json`
- Schema uses `anyOf` array within `$defs.Operation` (NOT `oneOf`)

**Token Naming Convention**:
- Operation handler tokens: `[OperationName]Handler` (e.g., `DrinkFromHandler`)
- **NO "I" prefix** for operation handlers (unlike service interfaces like `ILogger`)
- Explicitly documented in `tokens-core.js` lines 14-20

**DI Registration Pattern**:
- Handler registrations use `handlerFactories` array in `operationHandlerRegistrations.js`
- Format: `[token, HandlerClass, factoryFunction]`
- NOT direct `container.register()` calls

**Operation Registry Mapping**:
- Uses `registry.register()` calls within `OperationRegistry` factory
- NOT `registerOperation()` calls
- Located in `interpreterRegistrations.js`

**Special Cases**:
- Some operations in `KNOWN_OPERATION_TYPES` don't have schema files:
  - `HAS_BODY_PART_WITH_COMPONENT_VALUE` (may be legacy or special-case)
  - `SEQUENCE` (may be a meta-operation)
- Validation script should handle these gracefully

## Requirements

### 1. Validation Script

**File**: `scripts/validateOperations.js`

**Checks to Perform**:

1. **Schema Files Check**
   - Scan `data/schemas/operations/*.schema.json`
   - Exclude `base-operation.schema.json` and `nested-operation.schema.json`
   - Extract operation type from each schema (`allOf[1].properties.type.const`)

2. **Schema References Check**
   - Read `data/schemas/operation.schema.json` (root schemas directory, NOT in operations/)
   - Verify each operation schema is referenced in `anyOf` array within `$defs.Operation`
   - Report any orphaned schema files

3. **Pre-validation Whitelist Check**
   - Read `src/utils/preValidationUtils.js`
   - Extract `KNOWN_OPERATION_TYPES` array
   - Verify all operation types from schemas are in whitelist
   - Report missing entries
   - **Note**: Whitelist may contain entries without schemas (e.g., SEQUENCE, HAS_BODY_PART_WITH_COMPONENT_VALUE) - these are valid

4. **DI Token Definitions Check**
   - Read `src/dependencyInjection/tokens/tokens-core.js`
   - Extract all handler tokens from `coreTokens` object
   - Verify token exists for each operation
   - Check naming convention ([OperationName]Handler - NO "I" prefix for operation handlers)

5. **Handler Factory Registrations Check**
   - Read `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Extract all entries from `handlerFactories` array (format: [token, HandlerClass, factory])
   - Verify each operation has handler registered in the array
   - Check imports exist for all handler classes

6. **Operation Registry Mappings Check**
   - Read `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Extract all `registry.register()` calls within the OperationRegistry factory
   - Verify each operation type is mapped to a token
   - Check token names match exactly

7. **Handler File Existence Check**
   - Verify handler file exists at `src/logic/operationHandlers/[operationName]Handler.js`
   - Check file naming convention: camelCase + Handler.js (e.g., `drinkFromHandler.js`)
   - Report missing files
   - Skip special operations without schemas (SEQUENCE, HAS_BODY_PART_WITH_COMPONENT_VALUE)

8. **Naming Consistency Check**
   - Verify operation type in schema matches everywhere
   - Verify token naming is consistent
   - Verify file naming is consistent

### 2. Output Format

#### Success Output

```bash
$ npm run validate:operations

🔍 Validating operation registration completeness...

📋 Step 1: Scanning operation schemas...
  Found 23 operation schemas

📋 Step 2: Checking operation.schema.json references...
  23 schemas referenced ✓

📋 Step 3: Checking pre-validation whitelist...
  23 operation types in whitelist ✓

📋 Step 4: Checking DI tokens...
  23 handler tokens defined ✓

📋 Step 5: Checking handler factory registrations...
  23 handlers registered ✓

📋 Step 6: Checking operation registry mappings...
  23 operations mapped ✓

📋 Step 7: Checking handler file existence...
  23 handler files exist ✓

📋 Step 8: Checking naming consistency...
  All naming conventions followed ✓

======================================================================
📊 Validation Results

✅ All operation handlers are properly registered!

✓ 23 operations validated
✓ All schemas referenced
✓ All types in whitelist
✓ All tokens defined
✓ All handlers registered
✓ All operations mapped
✓ All handler files exist
✓ All naming conventions followed

======================================================================
```

#### Failure Output

```bash
$ npm run validate:operations

🔍 Validating operation registration completeness...

📋 Step 1: Scanning operation schemas...
  Found 24 operation schemas

📋 Step 2: Checking operation.schema.json references...
  23 schemas referenced
  ⚠️  1 schema not referenced

📋 Step 3: Checking pre-validation whitelist...
  22 operation types in whitelist
  ⚠️  2 operation types missing

[... other steps ...]

======================================================================
📊 Validation Results

❌ Errors found (5 total):

  ❌ Schema drinkFrom.schema.json not referenced in operation.schema.json
     Fix: Add { "$ref": "./drinkFrom.schema.json" } to oneOf array
     File: data/schemas/operations/operation.schema.json

  ❌ Operation type DRINK_FROM not in KNOWN_OPERATION_TYPES (preValidationUtils.js)
     Fix: Add 'DRINK_FROM' to KNOWN_OPERATION_TYPES array
     File: src/utils/preValidationUtils.js
     Line: ~15-30

  ❌ Operation type DRINK_ENTIRELY not in KNOWN_OPERATION_TYPES (preValidationUtils.js)
     Fix: Add 'DRINK_ENTIRELY' to KNOWN_OPERATION_TYPES array
     File: src/utils/preValidationUtils.js

  ❌ Token DrinkFromHandler not defined for operation DRINK_FROM (tokens-core.js)
     Fix: Add DrinkFromHandler: 'DrinkFromHandler' to coreTokens object (NO "I" prefix)
     File: src/dependencyInjection/tokens/tokens-core.js

  ❌ Handler file drinkFromHandler.js not found for operation DRINK_FROM
     Expected: src/logic/operationHandlers/drinkFromHandler.js
     Action: Create handler file or check file name

Found 5 error(s) that must be fixed.

📚 See docs/adding-operations.md for guidance on fixing these issues.
======================================================================

Process exited with code 1
```

### 3. Script Implementation Structure

```javascript
#!/usr/bin/env node

/**
 * Operation Registration Completeness Validator
 *
 * Checks that all operation handlers are properly registered across all required files
 *
 * Usage: npm run validate:operations
 */

import fs from 'fs';
import path from 'path';
import glob from 'glob';

const errors = [];
const warnings = [];

console.log('🔍 Validating operation registration completeness...\n');

// Step 1: Collect all operation schemas
console.log('📋 Step 1: Scanning operation schemas...');
const operationsFromSchemas = scanOperationSchemas();
console.log(`  Found ${operationsFromSchemas.length} operation schemas`);

// Step 2: Check operation.schema.json references
console.log('\n📋 Step 2: Checking operation.schema.json references...');
checkSchemaReferences(operationsFromSchemas);

// Step 3: Check KNOWN_OPERATION_TYPES
console.log('\n📋 Step 3: Checking pre-validation whitelist...');
checkPreValidationWhitelist(operationsFromSchemas);

// Step 4: Check DI tokens
console.log('\n📋 Step 4: Checking DI tokens...');
checkDITokens(operationsFromSchemas);

// Step 5: Check handler registrations
console.log('\n📋 Step 5: Checking handler factory registrations...');
checkHandlerRegistrations(operationsFromSchemas);

// Step 6: Check operation registry mappings
console.log('\n📋 Step 6: Checking operation registry mappings...');
checkOperationMappings(operationsFromSchemas);

// Step 7: Check handler files exist
console.log('\n📋 Step 7: Checking handler file existence...');
checkHandlerFiles(operationsFromSchemas);

// Step 8: Check naming consistency
console.log('\n📋 Step 8: Checking naming consistency...');
checkNamingConsistency(operationsFromSchemas);

// Report results
console.log('\n' + '='.repeat(70));
console.log('📊 Validation Results\n');

if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  warnings.forEach(w => console.log(`  ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.log('❌ Errors:');
  errors.forEach((e, idx) => {
    console.log(`\n  ${idx + 1}. ${e}`);
  });
  console.log();
  console.log(`Found ${errors.length} error(s) that must be fixed.`);
  console.log('\n📚 See docs/adding-operations.md for guidance on fixing these issues.');
  console.log('='.repeat(70));
  process.exit(1);
} else {
  console.log('✅ All operation handlers are properly registered!');
  console.log(`\n✓ ${operationsFromSchemas.length} operations validated`);
  console.log(`✓ All schemas referenced`);
  console.log(`✓ All types in whitelist`);
  console.log(`✓ All tokens defined`);
  console.log(`✓ All handlers registered`);
  console.log(`✓ All operations mapped`);
  console.log(`✓ All handler files exist`);
  console.log(`✓ All naming conventions followed`);
  console.log('='.repeat(70));
}

// Helper functions
function scanOperationSchemas() {
  const schemaFiles = glob.sync('data/schemas/operations/*.schema.json')
    .filter(f =>
      !f.endsWith('base-operation.schema.json') &&
      !f.endsWith('nested-operation.schema.json')
    );

  const operations = [];

  for (const schemaFile of schemaFiles) {
    try {
      const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
      // Extract operation type from allOf[1].properties.type.const
      const operationType = schema.allOf?.[1]?.properties?.type?.const;

      if (operationType) {
        operations.push({
          type: operationType,
          schemaFile: path.basename(schemaFile),
          schemaPath: schemaFile,
        });
      } else {
        warnings.push(`⚠️  Schema ${schemaFile} does not define operation type constant`);
      }
    } catch (error) {
      errors.push(`❌ Failed to parse schema ${schemaFile}: ${error.message}`);
    }
  }

  return operations;
}

function checkSchemaReferences(operations) {
  try {
    const operationSchemaPath = 'data/schemas/operation.schema.json';
    const operationSchema = JSON.parse(fs.readFileSync(operationSchemaPath, 'utf8'));

    // Schema uses anyOf within $defs.Operation
    const referencedSchemas = operationSchema.$defs?.Operation?.anyOf?.map(ref =>
      path.basename(ref.$ref)
    ) || [];

    console.log(`  ${referencedSchemas.length} schemas referenced`);

    for (const op of operations) {
      if (!referencedSchemas.includes(op.schemaFile)) {
        errors.push(
          `❌ Schema ${op.schemaFile} not referenced in operation.schema.json\n` +
          `   Fix: Add { "$ref": "./operations/${op.schemaFile}" } to anyOf array in $defs.Operation\n` +
          `   File: data/schemas/operation.schema.json`
        );
      }
    }
  } catch (error) {
    errors.push(`❌ Failed to check schema references: ${error.message}`);
  }
}

function checkPreValidationWhitelist(operations) {
  try {
    const preValidationPath = 'src/utils/preValidationUtils.js';
    const preValidationContent = fs.readFileSync(preValidationPath, 'utf8');

    const whitelistMatch = preValidationContent.match(/const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/);
    const knownTypes = [];

    if (whitelistMatch) {
      const whitelistBody = whitelistMatch[1];
      const matches = whitelistBody.matchAll(/'([^']+)'/g);
      for (const match of matches) {
        knownTypes.push(match[1]);
      }
    }

    console.log(`  ${knownTypes.length} operation types in whitelist`);

    for (const op of operations) {
      if (!knownTypes.includes(op.type)) {
        errors.push(
          `❌ Operation type ${op.type} not in KNOWN_OPERATION_TYPES (preValidationUtils.js)\n` +
          `   Fix: Add '${op.type}' to KNOWN_OPERATION_TYPES array\n` +
          `   File: src/utils/preValidationUtils.js`
        );
      }
    }
  } catch (error) {
    errors.push(`❌ Failed to check pre-validation whitelist: ${error.message}`);
  }
}

// ... Implement remaining check functions ...

/**
 * Convert operation type to token name
 * IMPORTANT: Operation handler tokens do NOT use "I" prefix (unlike service interfaces)
 * @example 'DRINK_FROM' -> 'DrinkFromHandler'
 */
function toTokenName(operationType) {
  return operationType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join('') + 'Handler';
}

function toHandlerFileName(operationType) {
  return operationType
    .split('_')
    .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase())
    .join('') + 'Handler.js';
}
```

### 4. Package.json Integration

```json
{
  "scripts": {
    "validate:operations": "node scripts/validateOperations.js"
  }
}
```

### 5. CI Integration

Update CI script to include operation validation:

```json
{
  "scripts": {
    "test:ci": "npm run validate:operations && npm run lint && npm run typecheck && npm run test:unit && npm run test:integration"
  }
}
```

## Acceptance Criteria

- [ ] Script validates all 8 registration points
- [ ] Exit code 0 on success, 1 on failure
- [ ] Clear, actionable error messages
- [ ] Runs in <5 seconds
- [ ] Works on Windows, macOS, Linux
- [ ] Detects all types of missing registrations
- [ ] Provides specific file paths and line suggestions
- [ ] Integrated into CI pipeline
- [ ] Documented in README.md
- [ ] Tests verify validation logic

## Testing

### Unit Tests

**File**: `tests/unit/scripts/validateOperations.test.js`

Test each validation function with known-good and known-bad data.

### Integration Tests

**File**: `tests/integration/scripts/validateOperations.integration.test.js`

Test scenarios:
1. All registrations present → Success
2. Missing schema reference → Error
3. Missing whitelist entry → Error
4. Missing token → Error
5. Missing handler registration → Error
6. Missing operation mapping → Error
7. Missing handler file → Error

### Manual Testing

1. Run on current codebase (should pass)
2. Comment out a registration point
3. Run script (should fail with specific error)
4. Restore registration
5. Verify pass again

## Implementation Notes

- Use synchronous file operations (script is short-lived)
- Handle JSON parsing errors gracefully
- Use regex for JavaScript file parsing (not full AST parsing)
- Keep script fast (<5 seconds)
- Make error messages actionable

## Time Estimate

8-10 hours (including testing)

## Related Tickets

- OPEHANIMP-007: CLI scaffolding tool (will use this for validation)
- OPEHANIMP-009: CI integration (depends on this)

## Success Metrics

- Catches 100% of missing registrations
- Zero false positives
- Runs in <5 seconds
- Clear error messages lead to quick fixes
