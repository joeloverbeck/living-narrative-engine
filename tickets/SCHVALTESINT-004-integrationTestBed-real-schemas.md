# SCHVALTESINT-004: Add Real Schema Option to IntegrationTestBed

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-001
**Blocks**: SCHVALTESINT-015

---

## Objective

Update `IntegrationTestBed` to optionally use real project schemas instead of test-only mocks, enabling integration tests to catch schema violations that would fail in production.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `tests/common/integrationTestBed.js` | Add option to use real schemas |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/common/integrationTestBed.validation.test.js` | Test new validation option |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/loaders/schemaLoader.js` | Understand how production loads schemas |
| `src/validation/ajvSchemaValidator.js` | Understand validator interface |

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
- Remove existing mock schema functionality
- Modify the DI container registration interface

---

## Implementation Details

### Current Code (Problem)

```javascript
// tests/common/integrationTestBed.js - approximate line 380

async initialize() {
  // Registers simplified test-only schemas
  this.container.register(tokens.ISchemaValidator, () => {
    return createMockSchemaValidator();  // ⚠️ MOCK - doesn't validate against real schemas
  });
}
```

### Required Changes

1. **Add `useRealSchemas` option** to `initialize()` method
2. **Load real schemas** when option is true using `SchemaLoader`
3. **Create real AJV validator** instance when using real schemas
4. **Document performance implications** (real schemas slower)
5. **Keep default behavior** as mock schemas (backward compatible)

### Suggested Implementation Pattern

```javascript
class IntegrationTestBed {
  #useRealSchemas = false;
  #realSchemaValidator = null;

  /**
   * Initialize the test bed
   * @param {Object} [options] - Initialization options
   * @param {boolean} [options.useRealSchemas=false] - Use real project schemas instead of mocks
   * @param {string[]} [options.schemaFilter] - Only load specific schemas (performance optimization)
   */
  async initialize(options = {}) {
    const { useRealSchemas = false, schemaFilter = null } = options;
    this.#useRealSchemas = useRealSchemas;

    if (useRealSchemas) {
      this.#realSchemaValidator = await this.#createRealValidator(schemaFilter);
      this.container.register(tokens.ISchemaValidator, () => this.#realSchemaValidator);
    } else {
      // Existing mock behavior
      this.container.register(tokens.ISchemaValidator, () => createMockSchemaValidator());
    }

    // ... rest of initialization
  }

  async #createRealValidator(schemaFilter) {
    const schemaLoader = new SchemaLoader(this.#logger);

    if (schemaFilter) {
      // Load only requested schemas for performance
      await schemaLoader.loadSchemas(schemaFilter);
    } else {
      // Load all schemas
      await schemaLoader.loadAndCompileAllSchemas();
    }

    return schemaLoader.getValidator();
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

### Schema Filter Example

```javascript
// For tests only needing rule validation
const testBed = new IntegrationTestBed();
await testBed.initialize({
  useRealSchemas: true,
  schemaFilter: [
    'schema://living-narrative-engine/rule.schema.json',
    'schema://living-narrative-engine/operation.schema.json',
    'schema://living-narrative-engine/operations/*.schema.json'
  ]
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing integration tests** must pass unchanged (use default mock behavior)
2. **New unit test**: `tests/unit/common/integrationTestBed.validation.test.js`
   - `should use mock schemas by default`
   - `should load real schemas when useRealSchemas=true`
   - `should validate against real schemas when enabled`
   - `should support schemaFilter for performance`
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

    // This would pass with mock but fail with real schemas if invalid
    expect(() => {
      validator.validate('schema://living-narrative-engine/rule.schema.json', invalidRule);
    }).toThrow();
  });
});
```

### Invariants That Must Remain True

1. **Backward Compatibility**: Tests not passing `useRealSchemas` work exactly as before
2. **Performance Opt-in**: Real schemas only loaded when requested
3. **Filter Support**: `schemaFilter` enables selective loading for speed

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/integration/ --no-coverage`
   - All tests pass with default mock behavior
2. Run single test with `useRealSchemas: true`
   - Should work but may be slower
3. Test with invalid rule data and `useRealSchemas: true`
   - Should throw validation error

---

## Performance Considerations

| Mode | Schema Load Time | Validation Speed |
|------|-----------------|------------------|
| Mock (default) | ~0ms | N/A (no validation) |
| Real (all schemas) | ~500-1000ms | Fast after load |
| Real (filtered) | ~50-200ms | Fast after load |

**Recommendation**: Use `schemaFilter` in tests that only need specific schemas.

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - requires understanding schema loading and DI
- **Risk**: Low - opt-in behavior preserves backward compatibility

## Review Checklist

- [ ] All existing integration tests pass unchanged
- [ ] New validation tests pass
- [ ] `useRealSchemas` option documented
- [ ] `schemaFilter` option documented
- [ ] Performance impact acceptable with filtering
- [ ] `isUsingRealSchemas()` exposed for test introspection
- [ ] JSDoc updated for `initialize()` method
