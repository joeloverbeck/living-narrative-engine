# SCHVALTESINT-004: Add Real Schema Option to IntegrationTestBed

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-001
**Blocks**: SCHVALTESINT-015
**Status**: ✅ COMPLETED

---

## Objective

Update `IntegrationTestBed` to optionally load real project schemas from `data/schemas/` instead of only registering simplified test-only component schemas, enabling integration tests to catch schema violations that would fail in production.

## File List

### Files to Modify

| File                                 | Change Type                                      |
| ------------------------------------ | ------------------------------------------------ |
| `tests/common/integrationTestBed.js` | Add option to load real schemas via SchemaLoader |

### Files to Create

| File                                                      | Purpose                    |
| --------------------------------------------------------- | -------------------------- |
| `tests/unit/common/integrationTestBed.validation.test.js` | Test new validation option |

### Files to Read (for reference)

| File                                   | Purpose                                 |
| -------------------------------------- | --------------------------------------- |
| `src/loaders/schemaLoader.js`          | Understand how production loads schemas |
| `src/validation/ajvSchemaValidator.js` | Understand validator interface          |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/ajvSchemaValidator.js` - Core validator must remain unchanged
- `src/loaders/schemaLoader.js` - Schema loader must remain unchanged
- Any files in `data/schemas/` - Schemas are not part of this ticket
- `tests/common/mods/ModTestFixture.js` - Already done in SCHVALTESINT-001/002
- `tests/common/engine/systemLogicTestEnv.js` - Already done in SCHVALTESINT-003

**DO NOT:**

- Make real schemas the default (would break many tests initially)
- Remove existing test schema functionality
- Modify the DI container registration interface

---

## Implementation Details

### Current Code (Corrected Understanding)

```javascript
// tests/common/integrationTestBed.js

async initialize() {
  // configureBaseContainer registers a REAL AjvSchemaValidator instance
  await configureBaseContainer(this.container, { ... });

  // Then we register simplified test-only component schemas
  await this._registerTestComponentSchemas();  // ⚠️ Only adds basic test schemas like core:name, core:position
  await this._registerTestEventDefinitions();  // ⚠️ Only adds basic event schemas
}

// The issue: The validator is real, but it only has hand-crafted minimal test schemas,
// NOT the full production schemas from data/schemas/
```

### Required Changes

1. **Add `useRealSchemas` option** to `initialize()` method
2. **Load real schemas via SchemaLoader** when option is true (SchemaLoader requires DI dependencies)
3. **Keep default behavior** - existing test schemas only (backward compatible)
4. **Track state** with `#useRealSchemas` private field
5. **Expose `isUsingRealSchemas()`** method for test introspection

### Corrected Implementation Pattern

```javascript
class IntegrationTestBed {
  #useRealSchemas = false;

  /**
   * Initialize the test bed
   * @param {Object} [options] - Initialization options
   * @param {boolean} [options.useRealSchemas=false] - Load all production schemas from data/schemas/
   */
  async initialize(options = {}) {
    const { useRealSchemas = false } = options;
    this.#useRealSchemas = useRealSchemas;

    await super.setup();

    // ... existing container setup ...

    await configureBaseContainer(this.container, { ... });

    // ... existing service overrides ...

    if (useRealSchemas) {
      // Load ALL production schemas via SchemaLoader (resolved from DI container)
      const schemaLoader = this.container.resolve(tokens.ISchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();
      // Note: schemaFilter removed - SchemaLoader doesn't support partial loading
    } else {
      // Default: register only simplified test schemas
      await this._registerTestComponentSchemas();
      await this._registerTestEventDefinitions();
    }

    // ... rest of initialization
  }

  /**
   * Check if using real schema validation
   * @returns {boolean}
   */
  isUsingRealSchemas() {
    return this.#useRealSchemas;
  }
}
```

### Note on schemaFilter

The original ticket proposed a `schemaFilter` option for performance. However, `SchemaLoader.loadAndCompileAllSchemas()` loads all schemas from the configuration and doesn't support partial loading. A filter feature would require modifying `SchemaLoader`, which is out of scope. For now, tests requiring real schemas will load all schemas.

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing integration tests** must pass unchanged (use default behavior)
2. **New unit test**: `tests/unit/common/integrationTestBed.validation.test.js`
   - `should use test schemas by default`
   - `should load real schemas when useRealSchemas=true`
   - `should validate against real schemas when enabled`
   - `should expose isUsingRealSchemas() method`
   - `should catch schema violations when using real schemas`

### Integration Test Update Example

```javascript
// Example: Updating existing test to use real schemas
describe('Integration with Real Schemas', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize({ useRealSchemas: true });
  });

  it('should validate rule against real schema', () => {
    const validator = testBed.container.resolve(tokens.ISchemaValidator);

    // This would pass with test schemas but fail with real schemas if invalid
    expect(() => {
      validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        invalidRule
      );
    }).toThrow();
  });
});
```

### Invariants That Must Remain True

1. **Backward Compatibility**: Tests not passing `useRealSchemas` work exactly as before
2. **Performance Opt-in**: Real schemas only loaded when explicitly requested

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/integration/ --no-coverage`
   - All tests pass with default behavior
2. Run single test with `useRealSchemas: true`
   - Should work but may be slower
3. Test with invalid rule data and `useRealSchemas: true`
   - Should throw validation error

---

## Performance Considerations

| Mode                   | Schema Load Time | Validation Speed       |
| ---------------------- | ---------------- | ---------------------- |
| Default (test schemas) | ~5-10ms          | Fast (minimal schemas) |
| Real (all schemas)     | ~500-1000ms      | Fast after load        |

**Recommendation**: Only use `useRealSchemas: true` for tests that specifically need to validate against production schemas.

---

## Estimated Effort

- **Size**: Small (S) - Simpler than originally estimated
- **Complexity**: Low - Just need to call SchemaLoader from DI container
- **Risk**: Low - opt-in behavior preserves backward compatibility

## Review Checklist

- [x] All existing integration tests pass unchanged
- [x] New validation tests pass
- [x] `useRealSchemas` option documented
- [x] `isUsingRealSchemas()` exposed for test introspection
- [x] JSDoc updated for `initialize()` method

---

## Outcome

### What Was Actually Changed

**Files Modified:**

- `tests/common/integrationTestBed.js`
  - Added imports: `readFile` from `node:fs/promises`, `SchemaLoader`, `StaticConfiguration`, `DefaultPathResolver`
  - Added `#useRealSchemas` private field
  - Modified `initialize()` to accept `options` parameter with `useRealSchemas` option
  - Added custom `SchemaLoader` construction with file-based fetcher (required because jsdom's fetch() doesn't work)
  - Added `isUsingRealSchemas()` method for test introspection

**Files Created:**

- `tests/integration/common/integrationTestBed.validation.test.js` (originally planned as unit test, moved to integration due to file system access requirements)
  - 13 test cases covering:
    - `isUsingRealSchemas()` return values (3 tests)
    - Default behavior with test schemas (3 tests)
    - `useRealSchemas: true` behavior (4 tests)
    - Backward compatibility (3 tests)

### Differences from Original Plan

1. **Test Location**: Test file created in `tests/integration/` instead of `tests/unit/` because `useRealSchemas: true` tests require file system access to load schemas, which doesn't work in jsdom's fetch() API.

2. **Custom SchemaLoader**: The implementation creates a custom `SchemaLoader` instance with a file-based fetcher using `node:fs/promises.readFile()` instead of using the DI-wired `SchemaLoader`. This was necessary because:
   - The DI-wired `SchemaLoader` uses `WorkspaceDataFetcher` which relies on `fetch()`
   - `fetch()` in jsdom tries HTTP requests which fail (no server)
   - File-based fetcher reads schemas directly from disk

3. **Token Name**: The ticket originally referenced `tokens.ISchemaLoader` but the correct token is `tokens.SchemaLoader` - this was a minor correction discovered during implementation.

4. **Validator Method**: The `AjvSchemaValidator.validate()` method returns `{ isValid: ..., errors: [...] }` not `{ valid: ..., errors: [...] }` - tests were updated to use the correct property name.

### All Tests Pass

- 237 tests pass in `tests/integration/common/` directory
- New 13 tests pass for the validation feature
- Backward compatibility verified - existing tests work unchanged
