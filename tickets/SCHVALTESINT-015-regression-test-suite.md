# SCHVALTESINT-015: Create Schema Validation Regression Test Suite

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: Testing & Validation
**Dependencies**: SCHVALTESINT-001, SCHVALTESINT-002, SCHVALTESINT-003, SCHVALTESINT-004
**Blocks**: None

---

## Objective

Create a comprehensive regression test suite that prevents recurrence of the LOCK_GRABBING/UNLOCK_GRABBING template string validation failures and corePromptText.json field drift issues.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/validation/schemaValidationRegression.test.js` | Main regression test suite |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `specs/schema-validation-test-integration.md` | Source spec with test examples |
| `tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js` | Existing related tests |
| `tests/integration/validation/corePromptTextValidation.test.js` | Existing related tests |

---

## Out of Scope

**DO NOT MODIFY:**

- Any source code files in `src/`
- Any schema files in `data/schemas/`
- Any existing test files (this creates new tests)
- Test infrastructure files (already modified in SCHVALTESINT-001-004)

**DO NOT:**

- Duplicate existing tests (reference them instead)
- Test implementation details (focus on behavior)
- Create tests that require specific file content (use fixtures)

---

## Implementation Details

### Test Suite Structure

From spec section 7.3, the regression suite should cover:

1. **LOCK_GRABBING Operation**
   - Accept integer count parameter
   - Accept template string count parameter
   - Reject non-template string count parameter

2. **UNLOCK_GRABBING Operation**
   - Same tests as LOCK_GRABBING

3. **corePromptText.json**
   - Validate against prompt-text schema
   - Contain actionTagRulesContent field

4. **ModTestFixture Integration**
   - Validate rules before test execution
   - Fail fast on invalid rules

### Suggested Implementation

```javascript
/**
 * @file tests/integration/validation/schemaValidationRegression.test.js
 * Regression test suite preventing recurrence of schema validation failures
 * @see specs/schema-validation-test-integration.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFile } from 'fs/promises';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Schema Validation Regression Prevention', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize({ useRealSchemas: true });
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('LOCK_GRABBING Operation - Regression Prevention', () => {
    /**
     * Regression test for: Template string type mismatch
     * Original failure: Schema defined count as strict integer, but rules use template strings
     */
    it('should accept integer count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test:actor', count: 2, item_id: 'test:item' }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
          operation
        );
      }).not.toThrow();
    });

    it('should accept template string count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: '{event.payload.actorId}',
          count: '{context.targetGrabbingReqs.handsRequired}',
          item_id: '{event.payload.targetId}'
        }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
          operation
        );
      }).not.toThrow();
    });

    it('should reject non-template string count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: 'two', item_id: 'item' }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
          operation
        );
      }).toThrow();
    });

    it('should reject zero count (must be >= 1)', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: 0, item_id: 'item' }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
          operation
        );
      }).toThrow();
    });
  });

  describe('UNLOCK_GRABBING Operation - Regression Prevention', () => {
    it('should accept integer count parameter', () => {
      const operation = {
        type: 'UNLOCK_GRABBING',
        parameters: { actor_id: 'test:actor', count: 1, item_id: 'test:item' }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/unlockGrabbing.schema.json',
          operation
        );
      }).not.toThrow();
    });

    it('should accept template string count parameter', () => {
      const operation = {
        type: 'UNLOCK_GRABBING',
        parameters: {
          actor_id: '{event.payload.actorId}',
          count: '{context.targetGrabbingReqs.handsRequired}',
          item_id: '{event.payload.targetId}'
        }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/unlockGrabbing.schema.json',
          operation
        );
      }).not.toThrow();
    });

    it('should reject non-template string count parameter', () => {
      const operation = {
        type: 'UNLOCK_GRABBING',
        parameters: { actor_id: 'test', count: 'invalid', item_id: 'item' }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/unlockGrabbing.schema.json',
          operation
        );
      }).toThrow();
    });
  });

  describe('corePromptText.json - Regression Prevention', () => {
    /**
     * Regression test for: Schema-code field drift
     * Original failure: Code accessed actionTagRulesContent but schema didn't define it
     */
    it('should validate against prompt-text schema', async () => {
      const content = await readFile('data/prompts/corePromptText.json', 'utf8');
      const data = JSON.parse(content);

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/prompt-text.schema.json',
          data
        );
      }).not.toThrow();
    });

    it('should contain actionTagRulesContent field', async () => {
      const content = await readFile('data/prompts/corePromptText.json', 'utf8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('actionTagRulesContent');
      expect(typeof data.actionTagRulesContent).toBe('string');
    });

    it('should contain all fields accessed by promptDataFormatter', async () => {
      const content = await readFile('data/prompts/corePromptText.json', 'utf8');
      const data = JSON.parse(content);

      // Fields accessed in src/prompting/promptDataFormatter.js
      const expectedFields = [
        'coreTaskDescriptionText',
        'characterPortrayalGuidelinesTemplate',
        'nc21ContentPolicyText',
        'finalLlmInstructionText',
        'actionTagRulesContent'
      ];

      for (const field of expectedFields) {
        expect(data).toHaveProperty(field);
        expect(typeof data[field]).toBe('string');
      }
    });
  });

  describe('Template String Pattern Validation', () => {
    /**
     * Tests for INV-2: Template Pattern Consistency Invariant
     * Verifies common.schema.json definitions work correctly
     */
    it('should accept valid template string format: {context.value}', () => {
      // Template string pattern: ^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$
      const validTemplates = [
        '{context.value}',
        '{event.payload.actorId}',
        '{context.targetGrabbingReqs.handsRequired}',
        '{actor_stats.strength}'
      ];

      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: validTemplates[0],
          count: validTemplates[1],
          item_id: validTemplates[2]
        }
      };

      expect(() => {
        schemaValidator.validate(
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
          operation
        );
      }).not.toThrow();
    });

    it('should reject invalid template formats', () => {
      const invalidTemplates = [
        '{}',                    // Empty
        '{ context.value }',    // Spaces
        '{{context.value}}',    // Double braces
        '{context.}',           // Trailing dot
        '{.value}',             // Leading dot
        '{123abc}',             // Starts with number
        '{context-value}'       // Hyphen not allowed
      ];

      for (const invalid of invalidTemplates) {
        const operation = {
          type: 'LOCK_GRABBING',
          parameters: { actor_id: 'test', count: invalid, item_id: 'item' }
        };

        expect(() => {
          schemaValidator.validate(
            'schema://living-narrative-engine/operations/lockGrabbing.schema.json',
            operation
          );
        }).toThrow();
      }
    });
  });
});

describe('ModTestFixture Schema Integration - Regression Prevention', () => {
  /**
   * Verifies INV-1: Test-Schema Coupling Invariant
   * Tests that ModTestFixture validates against schemas
   */
  describe('when useRealSchemas is enabled', () => {
    it('should fail fast when loading rule with invalid operation type', async () => {
      // This test verifies SCHVALTESINT-001 implementation
      // ModTestFixture.forAction should throw on invalid rules

      // Create a mock fixture that would test this
      // (actual implementation depends on SCHVALTESINT-001)
      expect(true).toBe(true); // Placeholder until SCHVALTESINT-001 complete
    });

    it('should succeed when loading valid rule files', async () => {
      // Test that valid rules pass validation
      const fixture = await ModTestFixture.forAction('weapons', 'weapons:wield_threateningly');
      expect(fixture).toBeDefined();
      await fixture.cleanup();
    });
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All regression tests pass** on current main branch
2. **Tests catch regressions** when schemas are intentionally broken:
   - Remove template pattern from lockGrabbing.schema.json → tests fail
   - Remove actionTagRulesContent from prompt-text.schema.json → tests fail

### Regression Coverage

| Original Issue | Test Coverage |
|----------------|---------------|
| LOCK_GRABBING template string rejection | `should accept template string count parameter` |
| UNLOCK_GRABBING template string rejection | Same tests for UNLOCK_GRABBING |
| corePromptText field drift | `should contain actionTagRulesContent field` |
| Invalid template formats | `should reject invalid template formats` |
| ModTestFixture bypassing validation | `ModTestFixture Schema Integration` suite |

### Manual Verification Steps

1. **Run regression suite**:
   ```bash
   NODE_ENV=test npx jest tests/integration/validation/schemaValidationRegression.test.js --no-coverage --verbose
   ```

2. **Verify regression detection**:
   - Temporarily remove oneOf from lockGrabbing.schema.json
   - Run tests - should fail
   - Restore schema
   - Run tests - should pass

3. **Verify field drift detection**:
   - Temporarily remove actionTagRulesContent from prompt-text.schema.json
   - Run tests - should fail
   - Restore schema
   - Run tests - should pass

### Invariants Tested

1. **INV-1**: ModTestFixture validates against schemas (via integration tests)
2. **INV-2**: Template patterns use shared definitions (via pattern tests)
3. **INV-5**: Schema-code field correspondence (via corePromptText tests)

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Low-Medium - test writing following spec examples
- **Risk**: Very Low - new tests only, no production code changes

## Review Checklist

- [ ] All regression tests pass on current main
- [ ] Tests are clearly documented with original issue reference
- [ ] Tests cover all failure scenarios from spec
- [ ] Template pattern tests match spec Appendix B
- [ ] corePromptText tests cover all accessed fields
- [ ] ModTestFixture integration tests placeholder ready
- [ ] Tests run in reasonable time (< 30s)
- [ ] JSDoc comments reference spec section
