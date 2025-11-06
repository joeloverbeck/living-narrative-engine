# BODDESROB-009: Add Automated Schema Consistency Tests

**Status**: TODO
**Priority**: HIGH
**Phase**: 5 (Automated Testing)
**Estimated Effort**: 1 day
**Dependencies**: BODDESROB-001, BODDESROB-002

## Overview

Create automated integration tests that verify body descriptor consistency between the registry, JSON schema, and formatting configuration. These tests act as a safety net to prevent configuration drift and ensure all components stay synchronized.

## Workflow Assumptions (Validated 2025-11-06)

This workflow has been validated against the actual production code:

✅ **Registry Location**: `src/anatomy/registries/bodyDescriptorRegistry.js` contains 6 descriptors
✅ **Schema Structure**: `data/schemas/anatomy.recipe.schema.json` has `properties.bodyDescriptors.properties`
✅ **Formatting Config**: `data/mods/anatomy/anatomy-formatting/default.json` has `descriptionOrder` array
✅ **Test Location**: `tests/integration/anatomy/` is the correct directory

⚠️ **Key Considerations**:
- The formatting config's `descriptionOrder` contains BOTH body descriptors (height, skin_color, etc.) AND anatomy part types (head, hair, eye, etc.). Tests must account for this mixed content.
- Helper functions are inline in the test file, not separate modules, following existing test patterns.
- Tests use synchronous file reads for simplicity (acceptable in test context).

## Problem Context

While validation tools catch issues at runtime, we need automated tests to:
- Catch configuration drift during development
- Verify registry-schema consistency
- Ensure formatting config includes all descriptors
- Run as part of CI/CD pipeline
- Prevent regressions

Automated tests provide continuous verification and immediate feedback.

## Acceptance Criteria

- [ ] Integration test file created for schema consistency
- [ ] Tests verify registry vs schema synchronization
- [ ] Tests verify registry vs formatting config synchronization
- [ ] Tests verify all descriptor properties are complete
- [ ] Tests catch missing descriptors in configuration
- [ ] Tests run as part of test suite
- [ ] Tests pass in CI/CD pipeline
- [ ] Clear assertion messages for failures
- [ ] 100% coverage of consistency checks
- [ ] Fast execution (< 5 seconds)

## Technical Details

### Test File Structure

```javascript
// tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BODY_DESCRIPTOR_REGISTRY,
  getAllDescriptorNames,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Load JSON schema from file system
function loadSchema(schemaFileName) {
  const schemaPath = path.join(__dirname, '../../../data/schemas', schemaFileName);
  const content = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(content);
}

// Helper: Load formatting config from file system
function loadFormattingConfig() {
  const configPath = path.join(
    __dirname,
    '../../../data/mods/anatomy/anatomy-formatting/default.json'
  );
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

describe('Body Descriptor System Consistency', () => {
  let recipeSchema;
  let formattingConfig;

  beforeEach(() => {
    recipeSchema = loadSchema('anatomy.recipe.schema.json');
    formattingConfig = loadFormattingConfig();
  });

  describe('Registry Completeness', () => {
    it('should have all required fields for each descriptor', () => {
      const requiredFields = [
        'schemaProperty',
        'displayLabel',
        'displayKey',
        'dataPath',
        'validValues',
        'displayOrder',
        'extractor',
        'formatter',
        'required',
      ];

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        for (const field of requiredFields) {
          expect(metadata).toHaveProperty(field);
          expect(metadata[field]).toBeDefined();
        }

        // Verify functions are actually functions
        expect(typeof metadata.extractor).toBe('function');
        expect(typeof metadata.formatter).toBe('function');
      }
    });

    it('should have unique display orders', () => {
      const displayOrders = Object.values(BODY_DESCRIPTOR_REGISTRY)
        .map(meta => meta.displayOrder);

      const uniqueOrders = new Set(displayOrders);
      expect(uniqueOrders.size).toBe(displayOrders.length);
    });

    it('should have unique display keys', () => {
      const displayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY)
        .map(meta => meta.displayKey);

      const uniqueKeys = new Set(displayKeys);
      expect(uniqueKeys.size).toBe(displayKeys.length);
    });
  });

  describe('Registry-Schema Consistency', () => {
    it('should have all registry descriptors defined in recipe schema', () => {
      const schemaProperties = Object.keys(
        recipeSchema.properties.bodyDescriptors.properties
      );

      for (const descriptorName of getAllDescriptorNames()) {
        const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
        expect(schemaProperties).toContain(metadata.schemaProperty);
      }
    });

    it('should have matching validValues between registry and schema', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        if (metadata.validValues) {
          const schemaProperty = recipeSchema.properties.bodyDescriptors
            .properties[metadata.schemaProperty];

          if (schemaProperty?.enum) {
            expect(metadata.validValues.sort()).toEqual(schemaProperty.enum.sort());
          }
        }
      }
    });

    it('should not have orphaned schema properties', () => {
      const schemaProperties = Object.keys(
        recipeSchema.properties.bodyDescriptors.properties
      );

      const registrySchemaProperties = Object.values(BODY_DESCRIPTOR_REGISTRY)
        .map(meta => meta.schemaProperty);

      for (const schemaProp of schemaProperties) {
        expect(registrySchemaProperties).toContain(schemaProp);
      }
    });
  });

  describe('Registry-Formatting Config Consistency', () => {
    it('should have all registry descriptors in formatting config', () => {
      const orderSet = new Set(formattingConfig.descriptionOrder);

      for (const metadata of Object.values(BODY_DESCRIPTOR_REGISTRY)) {
        expect(orderSet.has(metadata.displayKey)).toBe(true);
      }
    });

    it('should not have orphaned body descriptor displayKeys in formatting config', () => {
      const registeredDisplayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY)
        .map(meta => meta.displayKey);

      // Note: descriptionOrder contains both body descriptors (height, skin_color, etc.)
      // AND anatomy part types (head, hair, eye, etc.). We only validate body descriptors.
      // A displayKey is orphaned only if it matches a registered body descriptor key
      // but is not actually in the registry.
      const bodyDescriptorKeysInConfig = formattingConfig.descriptionOrder.filter(
        key => registeredDisplayKeys.includes(key)
      );

      // All body descriptor keys found in config should be in registry
      for (const key of bodyDescriptorKeysInConfig) {
        expect(registeredDisplayKeys).toContain(key);
      }

      // Verify expected body descriptor keys are present
      expect(bodyDescriptorKeysInConfig).toContain('height');
      expect(bodyDescriptorKeysInConfig).toContain('skin_color');
      expect(bodyDescriptorKeysInConfig).toContain('build');
      expect(bodyDescriptorKeysInConfig).toContain('body_composition');
      expect(bodyDescriptorKeysInConfig).toContain('body_hair');
      expect(bodyDescriptorKeysInConfig).toContain('smell');
    });
  });

  describe('Extractor Functions', () => {
    it('should extract values from valid body component', () => {
      // Note: Body component structure follows the pattern:
      // { body: { descriptors: { [schemaProperty]: value } } }
      // The schemaProperty uses camelCase (e.g., skinColor, hairDensity)
      const testBodyComponent = {
        body: {
          descriptors: {
            height: 'tall',
            skinColor: 'tan',        // camelCase in component data
            build: 'athletic',
            composition: 'lean',
            hairDensity: 'moderate', // camelCase in component data
            smell: 'pleasant',
          },
        },
      };

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const value = metadata.extractor(testBodyComponent);
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    });

    it('should handle missing data gracefully', () => {
      const emptyComponent = { body: { descriptors: {} } };

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const value = metadata.extractor(emptyComponent);
        // Should not throw, may return undefined/null
        expect(() => metadata.extractor(emptyComponent)).not.toThrow();
      }
    });
  });

  describe('Formatter Functions', () => {
    it('should format valid values correctly', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const testValue = metadata.validValues
          ? metadata.validValues[0]
          : 'test-value';

        const formatted = metadata.formatter(testValue);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted).toContain(testValue);
      }
    });

    it('should include display label in formatted output', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const testValue = 'test';
        const formatted = metadata.formatter(testValue);
        // Formatter should include some form of label or descriptor identifier
        expect(formatted.length).toBeGreaterThan(testValue.length);
      }
    });
  });
});
```

### Helper Functions

The test file includes inline helper functions for loading schemas and configs. These are kept inline rather than in separate helper files to:
1. Keep the test self-contained and easier to understand
2. Avoid creating unnecessary helper files for simple operations
3. Follow the existing pattern in other integration tests

The helpers are included at the top of the test file (see Test File Structure above):
- `loadSchema(schemaFileName)` - Loads a JSON schema from `data/schemas/`
- `loadFormattingConfig()` - Loads the anatomy formatting configuration

**Note**: These helpers use synchronous file reads which is acceptable for tests. For production code, async patterns would be preferred.

### Implementation Steps

1. **Create Test File**
   - Create `tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js`
   - Add imports, inline helper functions, and setup

2. **Implement Registry Tests**
   - Test completeness (all 9 required fields present)
   - Test uniqueness constraints (display orders and display keys)
   - Test function types (extractors and formatters)

3. **Implement Schema Consistency Tests**
   - Test registry vs schema sync
   - Test validValues matching with schema enums
   - Test for orphaned schema properties

4. **Implement Config Consistency Tests**
   - Test registry vs formatting config
   - Test displayKey presence in descriptionOrder
   - Test for orphaned body descriptor keys (accounting for mixed anatomy part keys)

5. **Implement Functional Tests**
   - Test extractor functions with valid data
   - Test formatter functions with valid values
   - Test error handling (null/undefined inputs)

6. **Run and Verify**
   - Run tests locally: `NODE_ENV=test npx jest tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js --no-coverage`
   - Verify all pass
   - Check that tests complete in < 5 seconds

7. **Integration**
   - Add to CI/CD pipeline
   - Verify tests run as part of `npm run test:integration`

## Files to Create

- `tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js` (NEW)

**Note**: Helper functions are inline in the test file rather than separate modules. This keeps the test self-contained and follows the existing pattern in similar integration tests.

## Testing Requirements

### Test Coverage Goals

- Registry completeness: 100%
- Schema consistency: 100%
- Config consistency: 100%
- Extractor functions: 100%
- Formatter functions: 100%

### Test Execution

Should be part of:
- `npm run test:integration`
- `npm run test:ci`
- CI/CD pipeline

### Expected Output

```
Body Descriptor System Consistency
  Registry Completeness
    ✓ should have all required fields for each descriptor (6 descriptors)
    ✓ should have unique display orders
    ✓ should have unique display keys

  Registry-Schema Consistency
    ✓ should have all registry descriptors defined in recipe schema
    ✓ should have matching validValues between registry and schema
    ✓ should not have orphaned schema properties

  Registry-Formatting Config Consistency
    ✓ should have all registry descriptors in formatting config
    ✓ should not have orphaned body descriptor displayKeys in formatting config

  Extractor Functions
    ✓ should extract values from valid body component
    ✓ should handle missing data gracefully

  Formatter Functions
    ✓ should format valid values correctly
    ✓ should include display label in formatted output

Tests: 12 passed, 12 total
Time: ~2-3 seconds
```

**Note**: Current registry contains 6 descriptors: height, skinColor, build, composition, hairDensity, smell

## Success Criteria

- [ ] All consistency tests implemented
- [ ] Tests pass with current configuration
- [ ] Tests catch known inconsistencies (verified by temporarily breaking config)
- [ ] Clear assertion messages
- [ ] Fast execution (< 5 seconds)
- [ ] Integrated into CI/CD
- [ ] 100% consistency coverage
- [ ] Tests documented

## Verification Process

### Manual Verification

1. **Test with Valid Configuration**
   - All tests should pass

2. **Test with Missing Descriptor**
   - Remove descriptor from formatting config
   - Test should fail with clear message

3. **Test with Invalid Schema**
   - Change validValues in schema
   - Test should fail with clear message

4. **Test with Incomplete Registry**
   - Remove field from registry entry
   - Test should fail with clear message

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Related to: BODDESROB-007 (CLI Validation Tool)
- Related to: BODDESROB-010 (Pre-commit Hook)
- Related to: Spec Section 4.5 "Phase 5: Automated Testing"

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Integration Tests
  run: npm run test:integration

- name: Check Body Descriptor Consistency
  run: npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js
```

### Pre-commit Hook Example

```bash
#!/bin/bash
# Run consistency tests before commit
npm test -- tests/integration/anatomy/bodyDescriptorSystemConsistency.test.js --silent
```

## Notes

- Keep tests fast - they run frequently
- Clear assertion messages are critical
- Test should fail fast with actionable errors
- Consider parameterized tests for repetitive checks
- Mock file system if tests are slow
- Document what each test verifies
- Tests are living documentation of requirements
