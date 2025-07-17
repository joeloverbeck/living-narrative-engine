# Schema ID Migration Specification

## Executive Summary

This specification outlines the migration from placeholder `http://example.com/schemas/` domain-based schema IDs to a local URI scheme format `schema://living-narrative-engine/` across the Living Narrative Engine codebase.

**Selected Approach**: Option 1 - Local URI Scheme  
**Target Format**: `schema://living-narrative-engine/[schema-name].schema.json`  
**Affected Files**: 67 schema files + 2 source files + multiple test files  
**Implementation Risk**: Medium (extensive but systematic changes)

## Rationale for Selected Approach

### Option 1: Local URI Scheme - `schema://living-narrative-engine/[schema-name].schema.json`

**Selected for the following reasons:**

1. **Clear Intent**: Custom scheme immediately signals these are local/private identifiers
2. **Maintains Structure**: Preserves the current path-like structure developers are familiar with
3. **AJV Compatibility**: Works seamlessly with AJV validator (tested with custom schemes)
4. **JSON Schema Compliance**: Meets JSON Schema draft-07 requirements for `$id` format
5. **Future-Proof**: Allows for versioning if needed (`schema://living-narrative-engine/v2/...`)
6. **No Ambiguity**: Cannot be confused with real URLs or cause network requests
7. **Namespace Clarity**: `living-narrative-engine` clearly identifies the project
8. **Developer Experience**: Easy to understand and maintain

### Comparison with Other Options

| Option               | Pros                                      | Cons                            | Score    |
| -------------------- | ----------------------------------------- | ------------------------------- | -------- |
| **Local URI Scheme** | Clear, familiar structure, AJV compatible | Non-standard scheme             | **9/10** |
| URN Format           | Standard RFC 2141                         | Less familiar, different syntax | 7/10     |
| Tag URI              | RFC 4151 standard, versioned              | Complex, unfamiliar             | 6/10     |
| Relative IDs         | Simple                                    | Validator issues, ambiguous     | 5/10     |

## Current State Analysis

### Schema ID Usage Patterns

1. **Schema Definition**: `$id` property in 67 schema files
2. **Cross-Schema References**: `$ref` properties pointing to other schema IDs
3. **Configuration Mapping**: Hardcoded mappings in `staticConfiguration.js`
4. **Runtime Validation**: Schema loading and AJV registration
5. **Test Assertions**: Hardcoded schema ID expectations

### Impact Assessment

**High Impact (Critical Path)**:

- `src/configuration/staticConfiguration.js` - 20+ hardcoded schema ID mappings
- `data/schemas/*.schema.json` - 67 schema files with `$id` properties
- Cross-references in schema files with `$ref` properties
- Test files with hardcoded assertions

**Low Impact (Automated)**:

- `src/loaders/schemaLoader.js` - Uses extracted IDs, no hardcoding
- Runtime validation logic - Works with registered schemas
- AJV validator operations - Uses loaded schema IDs

## Implementation Plan

### Phase 1: Pre-Implementation Setup

#### 1.1 Create Migration Utilities

Create helper scripts for systematic updates:

```bash
# Create migration tooling
mkdir -p tools/migration
touch tools/migration/schema-id-migrator.js
touch tools/migration/validate-migration.js
```

#### 1.2 Backup Current State

```bash
# Create backup of current schemas
cp -r data/schemas data/schemas.backup
cp src/configuration/staticConfiguration.js src/configuration/staticConfiguration.js.backup
```

#### 1.3 Identify All Cross-References

Run comprehensive search for all schema references:

```bash
# Find all $ref patterns
grep -r "\$ref.*http://example.com/schemas/" data/schemas/ > migration-refs.txt

# Find all hardcoded schema IDs
grep -r "http://example.com/schemas/" src/ tests/ > migration-hardcoded.txt
```

### Phase 2: Schema File Updates

#### 2.1 Update Schema `$id` Properties

**Target Transformation**:

```json
// FROM:
"$id": "http://example.com/schemas/component.schema.json"

// TO:
"$id": "schema://living-narrative-engine/component.schema.json"
```

**Files to Update** (67 total):

**Root Level Schemas (24 files)**:

- `data/schemas/action.schema.json`
- `data/schemas/action-result.schema.json`
- `data/schemas/anatomy-formatting.schema.json`
- `data/schemas/anatomy.blueprint.schema.json`
- `data/schemas/anatomy.blueprint-part.schema.json`
- `data/schemas/anatomy.recipe.schema.json`
- `data/schemas/anatomy.slot-library.schema.json`
- `data/schemas/base-operation.schema.json`
- `data/schemas/common.schema.json`
- `data/schemas/component.schema.json`
- `data/schemas/condition.schema.json`
- `data/schemas/condition-container.schema.json`
- `data/schemas/entity-definition.schema.json`
- `data/schemas/entity-instance.schema.json`
- `data/schemas/event.schema.json`
- `data/schemas/game.schema.json`
- `data/schemas/goal.schema.json`
- `data/schemas/json-logic.schema.json`
- `data/schemas/llm-configs.schema.json`
- `data/schemas/macro.schema.json`
- `data/schemas/mod-manifest.schema.json`
- `data/schemas/operation.schema.json`
- `data/schemas/prompt-text.schema.json`
- `data/schemas/rule.schema.json`
- `data/schemas/ui-icons.schema.json`
- `data/schemas/ui-labels.schema.json`
- `data/schemas/world.schema.json`

**Operation Schemas (43 files)**:

- All files in `data/schemas/operations/` directory

#### 2.2 Update Cross-Schema References

**Target Transformation**:

```json
// FROM:
"$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"

// TO:
"$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
```

**Common Reference Patterns**:

- References to `common.schema.json` definitions
- References to `component.schema.json` for validation
- References to `base-operation.schema.json` in operation schemas

### Phase 3: Source Code Updates

#### 3.1 Update Static Configuration

**File**: `src/configuration/staticConfiguration.js` (lines 134-165)

**Current Implementation**:

```javascript
getContentTypeSchemaId(registryKey) {
  const map = {
    components: 'http://example.com/schemas/component.schema.json',
    actions: 'http://example.com/schemas/action.schema.json',
    // ... 20+ more mappings
  };
  return map[registryKey];
}
```

**Updated Implementation**:

```javascript
getContentTypeSchemaId(registryKey) {
  const map = {
    components: 'schema://living-narrative-engine/component.schema.json',
    actions: 'schema://living-narrative-engine/action.schema.json',
    events: 'schema://living-narrative-engine/event.schema.json',
    conditions: 'schema://living-narrative-engine/condition.schema.json',
    macros: 'schema://living-narrative-engine/macro.schema.json',
    rules: 'schema://living-narrative-engine/rule.schema.json',
    goals: 'schema://living-narrative-engine/goal.schema.json',
    entityDefinitions: 'schema://living-narrative-engine/entity-definition.schema.json',
    entityInstances: 'schema://living-narrative-engine/entity-instance.schema.json',
    'llm-configs': 'schema://living-narrative-engine/llm-configs.schema.json',
    'mod-manifest': 'schema://living-narrative-engine/mod-manifest.schema.json',
    game: 'schema://living-narrative-engine/game.schema.json',
    world: 'schema://living-narrative-engine/world.schema.json',
    'prompt-text': 'schema://living-narrative-engine/prompt-text.schema.json',
    anatomyRecipes: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
    anatomyBlueprints: 'schema://living-narrative-engine/anatomy.blueprint.schema.json',
    anatomyBlueprintParts: 'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
    anatomySlotLibraries: 'schema://living-narrative-engine/anatomy.slot-library.schema.json',
    anatomyFormatting: 'schema://living-narrative-engine/anatomy-formatting.schema.json',
    scopes: null, // No change - custom DSL validation
  };
  return map[registryKey];
}
```

#### 3.2 Additional Configuration Methods

**Add new method for operation schema IDs**:

```javascript
/**
 * Gets schema ID for operation schemas
 * @param {string} operationName - Name of the operation
 * @returns {string} Schema ID for the operation
 */
getOperationSchemaId(operationName) {
  return `schema://living-narrative-engine/operations/${operationName}.schema.json`;
}
```

**Update rule schema ID method**:

```javascript
getRuleSchemaId() {
  return 'schema://living-narrative-engine/rule.schema.json';
}
```

### Phase 4: Test File Updates

#### 4.1 Update Test Assertions

**Files to Update**:

- `tests/unit/configuration/staticConfiguration.test.js`
- `tests/integration/anatomy/*.integration.test.js` (5 files)

**Example Update**:

```javascript
// FROM:
expect(schemaId).toBe('http://example.com/schemas/component.schema.json');

// TO:
expect(schemaId).toBe('schema://living-narrative-engine/component.schema.json');
```

#### 4.2 Update Schema Loading Tests

**Pattern to Update**:

```javascript
// FROM:
expect(
  validator.isSchemaLoaded('http://example.com/schemas/component.schema.json')
).toBe(true);

// TO:
expect(
  validator.isSchemaLoaded(
    'schema://living-narrative-engine/component.schema.json'
  )
).toBe(true);
```

### Phase 5: Validation and Testing

#### 5.1 AJV Compatibility Testing

**Test AJV with new URI scheme**:

```javascript
// Test script to verify AJV accepts custom URI scheme
const Ajv = require('ajv');
const ajv = new Ajv();

const testSchema = {
  $id: 'schema://living-narrative-engine/test.schema.json',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
};

ajv.addSchema(testSchema);
const validate = ajv.getSchema(
  'schema://living-narrative-engine/test.schema.json'
);
// Should not throw error
```

#### 5.2 Cross-Reference Resolution Testing

**Test `$ref` resolution**:

```javascript
// Verify that cross-references work with new scheme
const schema1 = {
  $id: 'schema://living-narrative-engine/base.schema.json',
  definitions: {
    commonType: { type: 'string' },
  },
};

const schema2 = {
  $id: 'schema://living-narrative-engine/derived.schema.json',
  type: 'object',
  properties: {
    field: {
      $ref: 'schema://living-narrative-engine/base.schema.json#/definitions/commonType',
    },
  },
};

ajv.addSchema(schema1);
ajv.addSchema(schema2);
// Should resolve references correctly
```

#### 5.3 Schema Loading Integration Test

**Test complete schema loading process**:

```javascript
// Verify schema loader works with new IDs
const schemaLoader = container.resolve('ISchemaLoader');
const validator = container.resolve('ISchemaValidator');

await schemaLoader.loadAllSchemas();

// Verify all schemas are loaded with new IDs
const expectedSchemas = [
  'schema://living-narrative-engine/component.schema.json',
  'schema://living-narrative-engine/action.schema.json',
  // ... all other schemas
];

expectedSchemas.forEach((schemaId) => {
  expect(validator.isSchemaLoaded(schemaId)).toBe(true);
});
```

## Migration Automation Strategy

### Automated Migration Script

**Create**: `tools/migration/schema-id-migrator.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class SchemaIdMigrator {
  constructor() {
    this.oldDomain = 'http://example.com/schemas/';
    this.newDomain = 'schema://living-narrative-engine/';
    this.changes = [];
  }

  async migrateAll() {
    console.log('Starting schema ID migration...');

    // 1. Migrate schema files
    await this.migrateSchemaFiles();

    // 2. Migrate source files
    await this.migrateSourceFiles();

    // 3. Migrate test files
    await this.migrateTestFiles();

    // 4. Generate migration report
    this.generateReport();

    console.log('Migration complete!');
  }

  async migrateSchemaFiles() {
    const schemaFiles = glob.sync('data/schemas/**/*.schema.json');

    for (const filePath of schemaFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const newContent = content.replace(
        new RegExp(this.oldDomain, 'g'),
        this.newDomain
      );

      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        this.changes.push({ file: filePath, type: 'schema' });
      }
    }
  }

  async migrateSourceFiles() {
    const sourceFiles = ['src/configuration/staticConfiguration.js'];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const newContent = content.replace(
        new RegExp(this.oldDomain, 'g'),
        this.newDomain
      );

      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        this.changes.push({ file: filePath, type: 'source' });
      }
    }
  }

  async migrateTestFiles() {
    const testFiles = glob.sync('tests/**/*.test.js');

    for (const filePath of testFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const newContent = content.replace(
        new RegExp(this.oldDomain, 'g'),
        this.newDomain
      );

      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        this.changes.push({ file: filePath, type: 'test' });
      }
    }
  }

  generateReport() {
    console.log('\nMigration Summary:');
    console.log(`Total files changed: ${this.changes.length}`);

    const byType = this.changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`${type}: ${count} files`);
    });
  }
}

// Run migration
if (require.main === module) {
  const migrator = new SchemaIdMigrator();
  migrator.migrateAll().catch(console.error);
}

module.exports = SchemaIdMigrator;
```

### Validation Script

**Create**: `tools/migration/validate-migration.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');
const Ajv = require('ajv');

class MigrationValidator {
  constructor() {
    this.ajv = new Ajv();
    this.errors = [];
    this.newDomain = 'schema://living-narrative-engine/';
    this.oldDomain = 'http://example.com/schemas/';
  }

  async validateMigration() {
    console.log('Validating migration...');

    // 1. Check for remaining old domain references
    this.checkForOldReferences();

    // 2. Validate all schema files can be loaded
    await this.validateSchemaLoading();

    // 3. Validate cross-references work
    await this.validateCrossReferences();

    // 4. Report results
    this.reportResults();

    return this.errors.length === 0;
  }

  checkForOldReferences() {
    const allFiles = glob
      .sync('data/schemas/**/*.json')
      .concat(glob.sync('src/**/*.js'))
      .concat(glob.sync('tests/**/*.js'));

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(this.oldDomain)) {
        this.errors.push(`Old domain reference found in: ${filePath}`);
      }
    }
  }

  async validateSchemaLoading() {
    const schemaFiles = glob.sync('data/schemas/**/*.schema.json');

    for (const filePath of schemaFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const schema = JSON.parse(content);

        // Check $id format
        if (!schema.$id || !schema.$id.startsWith(this.newDomain)) {
          this.errors.push(`Invalid $id in ${filePath}: ${schema.$id}`);
          continue;
        }

        // Try to add to AJV
        this.ajv.addSchema(schema);
      } catch (error) {
        this.errors.push(`Failed to load schema ${filePath}: ${error.message}`);
      }
    }
  }

  async validateCrossReferences() {
    const schemaFiles = glob.sync('data/schemas/**/*.schema.json');

    for (const filePath of schemaFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const schema = JSON.parse(content);

        // Check for $ref patterns
        const refs = this.findReferences(schema);

        for (const ref of refs) {
          if (ref.startsWith(this.newDomain)) {
            // Validate reference exists
            const targetSchema = ref.split('#')[0];
            if (!this.ajv.getSchema(targetSchema)) {
              this.errors.push(
                `Missing referenced schema: ${ref} in ${filePath}`
              );
            }
          }
        }
      } catch (error) {
        this.errors.push(
          `Failed to validate references in ${filePath}: ${error.message}`
        );
      }
    }
  }

  findReferences(obj, refs = []) {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.$ref) {
        refs.push(obj.$ref);
      }

      for (const key in obj) {
        this.findReferences(obj[key], refs);
      }
    }

    return refs;
  }

  reportResults() {
    if (this.errors.length === 0) {
      console.log('✅ Migration validation passed!');
    } else {
      console.log('❌ Migration validation failed:');
      this.errors.forEach((error) => console.log(`  - ${error}`));
    }
  }
}

// Run validation
if (require.main === module) {
  const validator = new MigrationValidator();
  validator
    .validateMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = MigrationValidator;
```

## Testing Strategy

### Pre-Migration Testing

1. **Backup Verification**:

   ```bash
   # Verify backups are created
   ls -la data/schemas.backup/
   ls -la src/configuration/staticConfiguration.js.backup
   ```

2. **Current State Documentation**:

   ```bash
   # Document current schema count
   find data/schemas -name "*.schema.json" | wc -l

   # Document current test status
   npm run test:ci
   ```

### Post-Migration Testing

1. **Automated Migration Validation**:

   ```bash
   node tools/migration/validate-migration.js
   ```

2. **Full Test Suite**:

   ```bash
   # Run all tests
   npm run test:ci

   # Run specific schema-related tests
   npm run test:unit -- --grep "schema"
   npm run test:integration -- --grep "schema"
   ```

3. **Schema Loading Integration Test**:

   ```bash
   # Test schema loading in isolation
   npm run test:integration -- tests/integration/loaders/schemaLoader.integration.test.js
   ```

4. **Manual Validation**:

   ```bash
   # Start application and verify it loads
   npm run start

   # Check for any console errors
   # Verify schema validation still works
   ```

### Regression Testing

1. **Content Validation**:
   - Load existing game content
   - Verify component validation works
   - Test action/event validation
   - Validate entity definitions

2. **Cross-Reference Testing**:
   - Test common.schema.json references
   - Verify operation schema inheritance
   - Test complex schema interactions

3. **Edge Case Testing**:
   - Test with malformed schema IDs
   - Test with missing schemas
   - Test with circular references

## Risk Assessment and Mitigation

### High Risk Areas

1. **Schema Loading Failure**
   - **Risk**: AJV rejects custom URI scheme
   - **Mitigation**: Pre-test AJV compatibility with custom schemes
   - **Rollback**: Restore from backup files

2. **Cross-Reference Resolution**
   - **Risk**: `$ref` resolution fails with new scheme
   - **Mitigation**: Comprehensive cross-reference testing
   - **Rollback**: Automated rollback script

3. **Test Suite Failures**
   - **Risk**: Missing test assertions cause failures
   - **Mitigation**: Systematic test file updates
   - **Rollback**: Git reset to previous commit

### Medium Risk Areas

1. **Content Validation Errors**
   - **Risk**: Existing content fails validation
   - **Mitigation**: Validate all existing content post-migration
   - **Rollback**: Per-file rollback for content issues

2. **Performance Impact**
   - **Risk**: New URI scheme affects performance
   - **Mitigation**: Benchmark schema loading performance
   - **Rollback**: Performance regression triggers rollback

### Low Risk Areas

1. **Development Workflow**
   - **Risk**: Developers confused by new scheme
   - **Mitigation**: Clear documentation and communication
   - **Rollback**: Not applicable - documentation issue

2. **Future Compatibility**
   - **Risk**: New scheme causes future tool issues
   - **Mitigation**: Document schema ID format in project docs
   - **Rollback**: Future migration if needed

## Rollback Strategy

### Immediate Rollback (If Migration Fails)

1. **Restore from Backup**:

   ```bash
   # Restore schema files
   rm -rf data/schemas/
   mv data/schemas.backup/ data/schemas/

   # Restore source files
   cp src/configuration/staticConfiguration.js.backup src/configuration/staticConfiguration.js

   # Restore test files if needed
   git checkout HEAD -- tests/
   ```

2. **Verify Rollback**:

   ```bash
   # Run test suite to verify rollback
   npm run test:ci

   # Check application startup
   npm run start
   ```

### Automated Rollback Script

**Create**: `tools/migration/rollback-migration.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MigrationRollback {
  constructor() {
    this.backupSuffix = '.backup';
  }

  async rollback() {
    console.log('Starting migration rollback...');

    try {
      // 1. Restore schema directory
      this.restoreDirectory('data/schemas');

      // 2. Restore source files
      this.restoreFile('src/configuration/staticConfiguration.js');

      // 3. Reset test files via git
      this.resetTestFiles();

      // 4. Verify rollback
      await this.verifyRollback();

      console.log('✅ Rollback completed successfully!');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    }
  }

  restoreDirectory(dirPath) {
    const backupPath = dirPath + this.backupSuffix;

    if (fs.existsSync(backupPath)) {
      console.log(`Restoring directory: ${dirPath}`);

      // Remove current directory
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true });
      }

      // Restore from backup
      fs.renameSync(backupPath, dirPath);
    } else {
      console.warn(`Backup not found: ${backupPath}`);
    }
  }

  restoreFile(filePath) {
    const backupPath = filePath + this.backupSuffix;

    if (fs.existsSync(backupPath)) {
      console.log(`Restoring file: ${filePath}`);
      fs.copyFileSync(backupPath, filePath);
    } else {
      console.warn(`Backup not found: ${backupPath}`);
    }
  }

  resetTestFiles() {
    console.log('Resetting test files via git...');
    try {
      execSync('git checkout HEAD -- tests/', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Git reset failed, test files may need manual restoration');
    }
  }

  async verifyRollback() {
    console.log('Verifying rollback...');

    // Check if old domain references are back
    const oldDomain = 'http://example.com/schemas/';
    const sampleFile = 'data/schemas/component.schema.json';

    if (fs.existsSync(sampleFile)) {
      const content = fs.readFileSync(sampleFile, 'utf8');
      if (content.includes(oldDomain)) {
        console.log('✅ Old domain references restored');
      } else {
        throw new Error('Rollback verification failed - old domain not found');
      }
    }

    // Run tests to verify functionality
    console.log('Running test suite to verify rollback...');
    try {
      execSync('npm run test:ci', { stdio: 'inherit' });
      console.log('✅ Test suite passed after rollback');
    } catch (error) {
      console.warn(
        '⚠️  Test suite failed after rollback - manual intervention may be needed'
      );
    }
  }
}

// Run rollback
if (require.main === module) {
  const rollback = new MigrationRollback();
  rollback.rollback().catch(console.error);
}

module.exports = MigrationRollback;
```

## Implementation Timeline

### Phase 1: Setup (1 day)

- [ ] Create migration tooling
- [ ] Create backups
- [ ] Set up validation scripts
- [ ] Test AJV compatibility

### Phase 2: Schema Migration (2 days)

- [ ] Run automated schema file migration
- [ ] Manually verify critical cross-references
- [ ] Update source configuration files
- [ ] Test schema loading

### Phase 3: Test Updates (1 day)

- [ ] Update test assertions
- [ ] Run full test suite
- [ ] Fix any failing tests
- [ ] Validate integration tests

### Phase 4: Validation (1 day)

- [ ] Run comprehensive validation
- [ ] Perform regression testing
- [ ] Benchmark performance
- [ ] Document any issues

### Phase 5: Cleanup (0.5 days)

- [ ] Remove backup files
- [ ] Update documentation
- [ ] Clean up migration tooling
- [ ] Create final migration report

**Total Estimated Time: 5.5 days**

## Success Criteria

### Technical Success Criteria

1. **All Tests Pass**: Complete test suite passes without failures
2. **Schema Loading Works**: All 67 schemas load successfully
3. **Cross-References Resolve**: All `$ref` patterns resolve correctly
4. **No Performance Regression**: Schema loading performance unchanged
5. **AJV Compatibility**: Custom URI scheme works with AJV validator

### Functional Success Criteria

1. **Application Starts**: Game engine starts without errors
2. **Content Validation**: Existing game content validates successfully
3. **Schema Registration**: All schemas register with AJV properly
4. **Error Handling**: Invalid schemas still produce proper error messages
5. **Development Workflow**: Developers can create new schemas with new format

### Quality Assurance Criteria

1. **No Old References**: Zero occurrences of old domain in codebase
2. **Consistent Format**: All schema IDs follow new format consistently
3. **Documentation Updated**: All relevant documentation reflects new format
4. **Migration Tooling**: Rollback procedures tested and documented
5. **Future Maintainability**: New schema creation process documented

## Post-Implementation Tasks

### 1. Documentation Updates

- [ ] Update README.md with new schema ID format
- [ ] Update developer documentation
- [ ] Create schema creation guide
- [ ] Document rollback procedures

### 2. Developer Communication

- [ ] Announce schema ID format change
- [ ] Provide migration timeline
- [ ] Share best practices for new format
- [ ] Document troubleshooting steps

### 3. Monitoring

- [ ] Monitor application performance
- [ ] Watch for schema-related errors
- [ ] Track developer feedback
- [ ] Monitor test suite stability

### 4. Cleanup

- [ ] Remove migration tooling after stable period
- [ ] Clean up backup files
- [ ] Archive migration documentation
- [ ] Update project conventions

## Conclusion

This migration from `http://example.com/schemas/` to `schema://living-narrative-engine/` represents a significant but manageable change to the Living Narrative Engine codebase. The selected Local URI Scheme approach provides the best balance of:

- **Clarity**: Immediately recognizable as local/private
- **Compatibility**: Works with existing tooling (AJV, JSON Schema)
- **Maintainability**: Familiar structure for developers
- **Future-proofing**: Allows for versioning and evolution

The comprehensive automation strategy, thorough testing approach, and robust rollback procedures ensure the migration can be completed safely with minimal risk to the project.

**Key Success Factors**:

1. Automated migration tooling reduces human error
2. Comprehensive testing validates all aspects of the change
3. Rollback procedures provide safety net
4. Clear documentation ensures smooth transition

The migration should be completed during a planned maintenance window with the full development team available to address any unexpected issues.
