# Ticket: Update action.schema.json with Multi-Target Support

## Ticket ID: PHASE1-TICKET1
## Priority: High
## Estimated Time: 4-6 hours
## Dependencies: None
## Blocks: PHASE2-TICKET4, PHASE2-TICKET5, PHASE4-TICKET13

## Overview

Update the existing action schema to support multi-target configurations while maintaining backward compatibility with single-target actions. This involves introducing a new `targets` property that can handle both legacy string scopes and new multi-target object configurations.

## Current State

The action schema currently uses a single `scope` property:
```json
{
  "scope": {
    "type": "string",
    "description": "Required. The namescaped DSL scope that defines where to look for potential targets for this action."
  }
}
```

## Target State

The schema should support:
1. Legacy single-target actions via string `targets` property
2. New multi-target actions via object `targets` property
3. Deprecation notice for old `scope` property
4. New `generateCombinations` flag for cartesian product generation

## Implementation Steps

### Step 1: Create Target Definition Schema

Add a new definition within action.schema.json for target specifications:

```json
"definitions": {
  "targetDefinition": {
    "type": "object",
    "properties": {
      "scope": {
        "type": "string",
        "description": "Scope ID or inline scope expression",
        "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$|^[^:]+$"
      },
      "placeholder": {
        "type": "string",
        "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$",
        "description": "Template placeholder name without braces"
      },
      "description": {
        "type": "string",
        "description": "Human-readable target description for UI/documentation"
      },
      "contextFrom": {
        "type": "string",
        "enum": ["primary"],
        "description": "Use another target as context for scope evaluation"
      },
      "optional": {
        "type": "boolean",
        "default": false,
        "description": "Whether this target is optional (action available even if no targets found)"
      }
    },
    "required": ["scope", "placeholder"],
    "additionalProperties": false
  }
}
```

### Step 2: Update Main Properties

Replace the current `scope` property with new `targets` property:

```json
{
  "properties": {
    // ... existing properties ...
    
    "targets": {
      "oneOf": [
        {
          "type": "string",
          "description": "Legacy single-target scope (backward compatibility)",
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
        },
        {
          "type": "object",
          "description": "Multi-target configuration",
          "properties": {
            "primary": {
              "$ref": "#/definitions/targetDefinition"
            },
            "secondary": {
              "$ref": "#/definitions/targetDefinition"
            },
            "tertiary": {
              "$ref": "#/definitions/targetDefinition"
            }
          },
          "required": ["primary"],
          "additionalProperties": false
        }
      ]
    },
    
    "scope": {
      "type": "string",
      "description": "DEPRECATED: Use 'targets' instead. Legacy support only.",
      "deprecated": true,
      "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
    },
    
    "generateCombinations": {
      "type": "boolean",
      "default": false,
      "description": "Generate all target combinations as separate actions (cartesian product)"
    }
  }
}
```

### Step 3: Update Required Fields

Modify the required array to handle both old and new formats:

```json
{
  "required": ["id", "description", "name", "template"],
  "allOf": [
    {
      "anyOf": [
        { "required": ["targets"] },
        { "required": ["scope"] }
      ]
    }
  ]
}
```

### Step 4: Add Validation Rules

Add JSON Schema validation rules to ensure:
1. Either `targets` or `scope` is provided (not both)
2. If using multi-target, placeholders match template variables
3. `contextFrom` references exist in targets object

```json
{
  "allOf": [
    {
      "if": {
        "properties": {
          "targets": { "type": "object" }
        }
      },
      "then": {
        "not": {
          "required": ["scope"]
        }
      }
    }
  ]
}
```

### Step 5: Add Schema Examples

Include examples in the schema file:

```json
{
  "examples": [
    {
      "$comment": "Legacy single-target action",
      "id": "core:eat",
      "name": "Eat",
      "description": "Consume an edible item",
      "targets": "core:edible_items",
      "template": "eat {target}"
    },
    {
      "$comment": "Multi-target throw action",
      "id": "combat:throw",
      "name": "Throw",
      "description": "Throw an item at a target",
      "targets": {
        "primary": {
          "scope": "combat:throwable_items",
          "placeholder": "item",
          "description": "Item to throw"
        },
        "secondary": {
          "scope": "combat:valid_targets",
          "placeholder": "target",
          "description": "Target to hit"
        }
      },
      "template": "throw {item} at {target}",
      "generateCombinations": true
    }
  ]
}
```

## Testing Requirements

### Unit Tests

Create test file: `tests/unit/schemas/actionSchemaMultiTarget.test.js`

```javascript
describe('Multi-Target Action Schema Validation', () => {
  let validator;
  
  beforeEach(() => {
    validator = new AjvSchemaValidator();
    // Load updated schema
  });
  
  describe('Backward Compatibility', () => {
    it('should accept legacy string scope', () => {
      const action = {
        id: 'test:action',
        name: 'Test',
        description: 'Test action',
        scope: 'test:scope',
        template: 'test {target}'
      };
      expect(validator.validate('action', action)).toBe(true);
    });
    
    it('should accept string targets property', () => {
      const action = {
        id: 'test:action',
        name: 'Test',
        description: 'Test action',
        targets: 'test:scope',
        template: 'test {target}'
      };
      expect(validator.validate('action', action)).toBe(true);
    });
  });
  
  describe('Multi-Target Validation', () => {
    it('should accept valid multi-target configuration', () => {
      const action = {
        id: 'test:multi',
        name: 'Multi',
        description: 'Multi-target action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item'
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
            contextFrom: 'primary'
          }
        },
        template: 'use {item} on {target}'
      };
      expect(validator.validate('action', action)).toBe(true);
    });
    
    it('should reject invalid placeholder patterns', () => {
      const action = {
        id: 'test:invalid',
        name: 'Invalid',
        description: 'Invalid placeholder',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: '123invalid' // starts with number
          }
        },
        template: 'test {123invalid}'
      };
      expect(validator.validate('action', action)).toBe(false);
    });
    
    it('should reject both targets and scope', () => {
      const action = {
        id: 'test:both',
        name: 'Both',
        description: 'Has both properties',
        targets: 'test:scope',
        scope: 'test:scope', // Should not have both
        template: 'test {target}'
      };
      expect(validator.validate('action', action)).toBe(false);
    });
  });
});
```

### Integration Tests

Ensure existing action files still validate:

```javascript
describe('Existing Action Files Validation', () => {
  it('should validate all existing action files', async () => {
    const actionFiles = await glob('data/mods/*/actions/*.action.json');
    
    for (const file of actionFiles) {
      const action = await readJSON(file);
      const result = validator.validate('action', action);
      expect(result).toBe(true, `Failed to validate ${file}`);
    }
  });
});
```

## Migration Considerations

1. **Deprecation Warning**: Add console warning when `scope` property is used
2. **Migration Script**: Consider creating automated migration tool for modders
3. **Documentation**: Update action creation docs with new format
4. **Version Check**: Consider adding schema version field for future migrations

## Acceptance Criteria

1. ✅ Schema validates all existing single-target actions
2. ✅ Schema supports new multi-target action format
3. ✅ Schema rejects invalid configurations (both targets and scope)
4. ✅ All placeholder patterns are validated
5. ✅ contextFrom references are validated
6. ✅ generateCombinations flag is optional with false default
7. ✅ Comprehensive unit tests pass
8. ✅ All existing action files continue to validate
9. ✅ Schema documentation is clear and includes examples
10. ✅ Deprecation notice added for scope property

## Performance Considerations

- Schema validation should remain fast (<5ms per action)
- No breaking changes to validation performance
- Consider caching compiled schema for repeated validations

## Security Considerations

- Validate placeholder names to prevent injection attacks
- Ensure scope patterns cannot reference system files
- Limit maximum number of targets to prevent DoS

## Future Enhancements

- Support for dynamic target count
- Target dependencies beyond linear (e.g., target C depends on A and B)
- Target validation rules within schema
- Custom target resolution strategies