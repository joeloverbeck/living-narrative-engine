# AJVVALENH-005: Implement Discriminated Union Schema Pattern

## Priority: 3 - Medium

## Problem Statement
The current `operation.schema.json` uses an `anyOf` array with 41 different operation schemas. When validation fails, AJV attempts to validate against EVERY schema in the array, causing error explosion. Using JSON Schema's discriminated union pattern with `if/then/else` would provide clearer validation paths and more targeted error messages.

## Current State
- `operation.schema.json` uses `anyOf` with 41 operation schemas
- Each validation failure tests all 41 schemas
- No clear discrimination based on operation type
- Error messages don't indicate which schema was expected

## Technical Requirements

### 1. Current Schema Structure (Problem)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "anyOf": [
    { "$ref": "operations/if.schema.json" },
    { "$ref": "operations/queryComponent.schema.json" },
    { "$ref": "operations/setComponent.schema.json" },
    // ... 38 more operations
  ]
}
```

### 2. New Discriminated Union Pattern

#### Option A: Nested if/then/else Chain
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": ["IF", "QUERY_COMPONENT", "SET_COMPONENT", /* ... all 41 types */]
    }
  },
  "required": ["type"],
  "allOf": [
    {
      "if": {
        "properties": { "type": { "const": "IF" } }
      },
      "then": {
        "$ref": "operations/if.schema.json"
      }
    },
    {
      "if": {
        "properties": { "type": { "const": "QUERY_COMPONENT" } }
      },
      "then": {
        "$ref": "operations/queryComponent.schema.json"
      }
    },
    {
      "if": {
        "properties": { "type": { "const": "SET_COMPONENT" } }
      },
      "then": {
        "$ref": "operations/setComponent.schema.json"
      }
    }
    // ... continue for all 41 operations
  ]
}
```

#### Option B: Discriminator with oneOf (JSON Schema 2020-12)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "discriminator": {
    "propertyName": "type",
    "mapping": {
      "IF": "operations/if.schema.json",
      "QUERY_COMPONENT": "operations/queryComponent.schema.json",
      "SET_COMPONENT": "operations/setComponent.schema.json"
      // ... all 41 operations
    }
  },
  "oneOf": [
    { "$ref": "operations/if.schema.json" },
    { "$ref": "operations/queryComponent.schema.json" },
    { "$ref": "operations/setComponent.schema.json" }
    // ... all 41 operations
  ]
}
```

#### Option C: Custom Discriminator Logic (Recommended)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": ["IF", "QUERY_COMPONENT", "SET_COMPONENT", /* ... */]
    }
  },
  "required": ["type"],
  "dependencies": {
    "type": {
      "oneOf": [
        {
          "properties": { "type": { "const": "IF" } },
          "$ref": "operations/if.schema.json"
        },
        {
          "properties": { "type": { "const": "QUERY_COMPONENT" } },
          "$ref": "operations/queryComponent.schema.json"
        }
        // ... all 41 operations
      ]
    }
  }
}
```

### 3. Schema Generator Implementation

Create a tool to generate the discriminated union schema:
```javascript
// scripts/generateDiscriminatedOperationSchema.js
import fs from 'fs';
import path from 'path';

class DiscriminatedSchemaGenerator {
  constructor(operationsDir, outputPath) {
    this.operationsDir = operationsDir;
    this.outputPath = outputPath;
    this.operations = [];
  }
  
  async generate() {
    // Step 1: Discover all operation schemas
    this.operations = await this.discoverOperations();
    
    // Step 2: Generate discriminated schema
    const schema = this.buildDiscriminatedSchema();
    
    // Step 3: Write schema file
    await this.writeSchema(schema);
    
    // Step 4: Generate migration guide
    await this.generateMigrationGuide();
  }
  
  discoverOperations() {
    const files = fs.readdirSync(this.operationsDir);
    return files
      .filter(f => f.endsWith('.schema.json'))
      .map(f => {
        const schema = JSON.parse(fs.readFileSync(
          path.join(this.operationsDir, f), 'utf8'
        ));
        const typeName = f.replace('.schema.json', '')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toUpperCase();
        return {
          type: typeName,
          file: f,
          schema
        };
      });
  }
  
  buildDiscriminatedSchema() {
    const allTypes = this.operations.map(op => op.type);
    
    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/operation-discriminated.schema.json",
      "title": "Operation (Discriminated Union)",
      "description": "Discriminated union schema for all operation types",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": allTypes,
          "description": "The operation type discriminator"
        }
      },
      "required": ["type"],
      "allOf": this.operations.map(op => ({
        "if": {
          "properties": {
            "type": { "const": op.type }
          }
        },
        "then": {
          "$ref": `operations/${op.file}`
        }
      }))
    };
  }
}
```

### 4. Validation Performance Comparison

Create benchmarks to compare performance:
```javascript
// tests/performance/validation/discriminatedUnionBenchmark.js
describe('Discriminated Union Performance', () => {
  let anyOfValidator;
  let discriminatedValidator;
  
  beforeAll(() => {
    anyOfValidator = createValidator('operation.schema.json');
    discriminatedValidator = createValidator('operation-discriminated.schema.json');
  });
  
  it('should validate valid operations faster', () => {
    const operation = {
      type: 'IF',
      parameters: {
        condition: { '==': [1, 1] },
        then_actions: []
      }
    };
    
    // Measure anyOf performance
    const anyOfStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      anyOfValidator.validate(operation);
    }
    const anyOfDuration = performance.now() - anyOfStart;
    
    // Measure discriminated performance
    const discriminatedStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      discriminatedValidator.validate(operation);
    }
    const discriminatedDuration = performance.now() - discriminatedStart;
    
    console.log(`anyOf: ${anyOfDuration}ms`);
    console.log(`discriminated: ${discriminatedDuration}ms`);
    console.log(`Improvement: ${((anyOfDuration - discriminatedDuration) / anyOfDuration * 100).toFixed(2)}%`);
    
    expect(discriminatedDuration).toBeLessThan(anyOfDuration);
  });
  
  it('should generate fewer errors for invalid operations', () => {
    const invalidOperation = {
      type: 'IF',
      condition: {},  // Wrong structure
      then_actions: []
    };
    
    const anyOfErrors = anyOfValidator.validate(invalidOperation);
    const discriminatedErrors = discriminatedValidator.validate(invalidOperation);
    
    console.log(`anyOf errors: ${anyOfErrors.length}`);
    console.log(`discriminated errors: ${discriminatedErrors.length}`);
    
    expect(discriminatedErrors.length).toBeLessThan(anyOfErrors.length / 10);
  });
});
```

### 5. Migration Strategy

#### Phase 1: Parallel Implementation
1. Create new discriminated schema alongside existing
2. Add feature flag to switch between schemas
3. Run both validators in parallel for comparison

#### Phase 2: Gradual Rollout
```javascript
// src/validation/schemaSelector.js
export class SchemaSelector {
  constructor(config) {
    this.useDiscriminated = config.features?.discriminatedSchemas ?? false;
    this.rolloutPercentage = config.discriminatedRollout ?? 0;
  }
  
  selectOperationSchema() {
    // Feature flag check
    if (this.useDiscriminated) {
      return 'operation-discriminated.schema.json';
    }
    
    // Gradual rollout
    if (Math.random() * 100 < this.rolloutPercentage) {
      return 'operation-discriminated.schema.json';
    }
    
    return 'operation.schema.json';
  }
}
```

#### Phase 3: Full Migration
1. Monitor error rates and performance
2. Collect developer feedback
3. Switch default to discriminated schema
4. Deprecate anyOf schema

### 6. Backward Compatibility

Ensure the new schema maintains compatibility:
```javascript
describe('Schema Compatibility', () => {
  it('should accept all previously valid operations', () => {
    const testCases = loadAllValidTestCases();
    
    testCases.forEach(testCase => {
      const oldResult = validateWithOldSchema(testCase);
      const newResult = validateWithNewSchema(testCase);
      
      expect(newResult.valid).toBe(oldResult.valid);
    });
  });
  
  it('should reject all previously invalid operations', () => {
    const testCases = loadAllInvalidTestCases();
    
    testCases.forEach(testCase => {
      const oldResult = validateWithOldSchema(testCase);
      const newResult = validateWithNewSchema(testCase);
      
      expect(newResult.valid).toBe(false);
      expect(oldResult.valid).toBe(false);
    });
  });
});
```

### 7. Error Message Improvements

The discriminated union will improve error messages:
```javascript
// Before (anyOf)
// Error: Data does not match any schema in anyOf
// Followed by 700+ sub-errors

// After (discriminated)
// Error: When type is "IF", parameters must contain "condition" and "then_actions"
// Clear, targeted error for the specific operation type
```

## Success Criteria

### Functional Requirements
- [ ] Discriminated schema validates all operations correctly
- [ ] Error messages are clear and targeted
- [ ] Performance is improved (target: 50% faster)
- [ ] Backward compatibility maintained

### Quality Requirements
- [ ] No regression in validation accuracy
- [ ] Error count reduced by >90% for structural issues
- [ ] Schema is maintainable and extensible
- [ ] Migration path is safe and reversible

## Test Requirements

### Unit Tests
- Test discriminated schema with all 41 operations
- Verify error message improvements
- Test edge cases and malformed data
- Benchmark performance improvements

### Integration Tests
- Test with actual game data files
- Verify mod loading still works
- Test error reporting in UI
- Test with validation pipeline

### Compatibility Tests
- Compare results with old schema
- Ensure no valid operations rejected
- Ensure no invalid operations accepted
- Test migration process

## Dependencies
- Should be implemented after AJVVALENH-001 through AJVVALENH-004
- Requires careful testing to avoid breaking changes
- May require AJV configuration updates

## Estimated Complexity
- **Effort**: 6-8 hours
- **Risk**: Medium-High (schema changes affect entire system)
- **Testing**: 4-5 hours
- **Migration**: 2-3 hours

## Implementation Notes

### Key Considerations
1. **AJV Version**: Ensure AJV supports the chosen pattern
2. **Performance**: Benchmark before committing to approach
3. **Tooling**: Update VS Code schema validation
4. **Documentation**: Update schema documentation

### Schema Maintenance
1. Create generator script for maintainability
2. Keep operation schemas modular
3. Version schemas for rollback capability
4. Document the discrimination pattern

### Risk Mitigation
1. Implement behind feature flag
2. Run parallel validation initially
3. Monitor error rates closely
4. Have rollback plan ready

## Definition of Done
- [ ] Discriminated schema generated
- [ ] Performance benchmarks show improvement
- [ ] All tests passing with new schema
- [ ] Migration strategy documented
- [ ] Feature flag implemented
- [ ] Backward compatibility verified
- [ ] Documentation updated
- [ ] Rollback plan tested

## Related Tickets
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-004: Create Validation Testing Suite
- AJVVALENH-006: Create Two-Phase Validation System

## Notes
This is a significant architectural change that will greatly improve the validation experience. The discriminated union pattern will make validation faster, errors clearer, and the system more maintainable. However, it must be implemented carefully with proper testing and migration planning to avoid disrupting the existing system.