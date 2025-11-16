# MODCOMPLASUP-009: Schema Updates for MODIFY_COMPONENT Mode

**Spec Reference**: `specs/modify-component-planner-support.md` - Section 6
**Related GOAP Spec**: `specs/goap-system-specs.md` - Task schema, planning effects

## Summary
Update JSON schemas to properly document and validate the `mode` parameter for MODIFY_COMPONENT operations. Ensure schema clearly defines the three modes: set, increment, decrement.

## Problem
The MODIFY_COMPONENT operation schema may not explicitly define or validate the `mode` parameter, which is critical for numeric planning. Need to ensure schemas are complete and consistent.

## Objectives
- Add/verify `mode` enum to MODIFY_COMPONENT schema
- Document mode semantics in schema
- Ensure proper validation of mode parameter
- Update task schema with mode documentation

## Schema Updates Required

### 1. MODIFY_COMPONENT Operation Schema

**File**: `data/schemas/operations/modifyComponent.schema.json`

**Verify/Update**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MODIFY_COMPONENT Operation",
  "description": "Modifies numeric fields in an entity component during planning or execution",
  "type": "object",
  "properties": {
    "type": {
      "const": "MODIFY_COMPONENT",
      "description": "Operation type identifier"
    },
    "parameters": {
      "type": "object",
      "properties": {
        "entityId": {
          "type": "string",
          "description": "ID of the entity to modify"
        },
        "componentId": {
          "type": "string",
          "description": "ID of the component to modify",
          "pattern": "^[a-z0-9_]+:[a-z0-9_]+$"
        },
        "modifications": {
          "type": "object",
          "description": "Map of field names to numeric modification values",
          "additionalProperties": {
            "type": "number",
            "description": "Numeric value for modification"
          },
          "minProperties": 1
        },
        "mode": {
          "type": "string",
          "enum": ["set", "increment", "decrement"],
          "default": "set",
          "description": "Modification mode: 'set' (assign value), 'increment' (add value), 'decrement' (subtract value)"
        }
      },
      "required": ["entityId", "componentId", "modifications"],
      "additionalProperties": false
    }
  },
  "required": ["type", "parameters"],
  "additionalProperties": false,
  "examples": [
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:needs",
        "modifications": { "hunger": 20 },
        "mode": "set"
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:stats",
        "modifications": { "health": 30 },
        "mode": "increment"
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entityId": "actor",
        "componentId": "core:needs",
        "modifications": { "hunger": 60 },
        "mode": "decrement"
      }
    }
  ]
}
```

**Key Changes**:
- ✅ `mode` has explicit enum: `["set", "increment", "decrement"]`
- ✅ `mode` has default value: `"set"`
- ✅ Description explains each mode
- ✅ `modifications` additionalProperties restricted to `number` type
- ✅ `modifications` requires at least 1 property
- ✅ Examples show all three modes
- ✅ No additional properties allowed (strict validation)

### 2. Task Schema Enhancement

**File**: `data/schemas/task.schema.json`

**Add Clarification in Comments** (if not present):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Task",
  "type": "object",
  "properties": {
    "planningEffects": {
      "type": "array",
      "description": "Effects that occur during planning simulation. MODIFY_COMPONENT supports 'set', 'increment', and 'decrement' modes.",
      "items": {
        "anyOf": [
          { "$ref": "./operations/addComponent.schema.json" },
          { "$ref": "./operations/removeComponent.schema.json" },
          {
            "$ref": "./operations/modifyComponent.schema.json",
            "description": "Numeric component modification. Modes: 'set' (default, assign value), 'increment' (add value), 'decrement' (subtract value)"
          }
        ]
      }
    }
  }
}
```

### 3. Goal Schema Review

**File**: `data/schemas/goal.schema.json`

**Verify** (should already support numeric constraints via JSON Logic):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Goal",
  "type": "object",
  "properties": {
    "goalState": {
      "description": "JSON Logic expression defining goal satisfaction. Supports numeric comparisons (>, <, >=, <=, ==) for numeric constraint planning.",
      "type": "object"
    },
    "relevance": {
      "description": "JSON Logic expression defining when goal is relevant. Supports numeric comparisons.",
      "type": "object"
    }
  }
}
```

**Action**: Add clarification that numeric operators are supported if not present.

## Validation Strategy

### Schema Validation
```bash
# Validate schema syntax
npm run validate:schemas

# Test schema against example data
npm run test:schemas
```

### Integration Testing
Create test to verify schema correctly validates:

**File**: `tests/integration/schemas/modifyComponentSchema.integration.test.js`

```javascript
describe('MODIFY_COMPONENT Schema Validation', () => {
  it('should validate set mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: 20 },
        mode: 'set'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(true);
  });

  it('should validate increment mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:stats',
        modifications: { health: 30 },
        mode: 'increment'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(true);
  });

  it('should validate decrement mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: 60 },
        mode: 'decrement'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(true);
  });

  it('should default to set mode when not specified', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: 20 }
        // mode omitted
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: 20 },
        mode: 'multiply' // invalid
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('enum')
      })
    );
  });

  it('should reject non-numeric modifications', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: "high" }, // invalid
        mode: 'set'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(false);
  });

  it('should reject empty modifications', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: {}, // empty
        mode: 'set'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(false);
  });

  it('should validate multiple field modifications', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: {
          hunger: -20,
          thirst: -10,
          energy: 5
        },
        mode: 'decrement'
      }
    };

    const result = validateOperation(operation);
    expect(result.valid).toBe(true);
  });
});
```

## Dependencies
None (can be done independently)

## Testing Requirements

### Schema Tests
- ✅ Valid set mode operation
- ✅ Valid increment mode operation
- ✅ Valid decrement mode operation
- ✅ Default mode behavior (set when omitted)
- ✅ Invalid mode rejection
- ✅ Non-numeric modification rejection
- ✅ Empty modifications rejection
- ✅ Multiple field modifications
- ✅ Component ID pattern validation
- ✅ Required fields validation

### Validation Commands
```bash
npm run validate:schemas
npm run test:integration -- tests/integration/schemas/modifyComponentSchema.integration.test.js
```

## Acceptance Criteria
- [ ] MODIFY_COMPONENT schema has mode enum defined
- [ ] Mode enum includes all three values: set, increment, decrement
- [ ] Mode has default value of "set"
- [ ] Mode has descriptive documentation
- [ ] Modifications restricted to numeric values
- [ ] Modifications requires at least 1 property
- [ ] Schema includes examples for all modes
- [ ] Task schema documentation mentions mode support
- [ ] Goal schema clarifies numeric operator support
- [ ] Integration test file created with 10+ test cases
- [ ] All schema validation tests passing
- [ ] Schema syntax valid (AJV compiles without errors)
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Estimated Effort
0.5 hours

## Follow-up Tickets
- MODCOMPLASUP-010: Performance benchmarking
