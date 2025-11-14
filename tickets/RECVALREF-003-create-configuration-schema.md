# RECVALREF-003: Create Validation Configuration Schema

**Phase:** 1 - Foundation & Interfaces
**Priority:** P0 - Critical
**Estimated Effort:** 2 hours
**Dependencies:** None

## Context

Currently, all validation behavior is hardcoded:
- Mod dependencies hardcoded in CLI script
- Validator enable/disable flags scattered throughout code
- No environment-specific configuration
- Cannot customize severity levels

This ticket creates a JSON schema for centralized, flexible validation configuration.

## Objectives

1. Define JSON schema for validation configuration
2. Support mod loading configuration (essential, optional, auto-detect)
3. Enable validator enable/disable and priority configuration
4. Support error severity overrides
5. Configure output formatting options

## Implementation Details

### File to Create

`data/schemas/validation-config.schema.json`

### Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/validation-config.schema.json",
  "title": "Recipe Validation Configuration",
  "description": "Configuration schema for recipe validation system",
  "type": "object",
  "properties": {
    "mods": {
      "type": "object",
      "properties": {
        "essential": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Always-loaded mods for validation"
        },
        "optional": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Optionally-loaded mods"
        },
        "autoDetect": {
          "type": "boolean",
          "description": "Auto-detect recipe's mod from path"
        }
      },
      "required": ["essential", "autoDetect"]
    },
    "validators": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Validator identifier"
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether validator is enabled"
          },
          "priority": {
            "type": "integer",
            "description": "Execution priority (lower = first)"
          },
          "failFast": {
            "type": "boolean",
            "description": "Stop pipeline on validator failure"
          },
          "config": {
            "type": "object",
            "description": "Validator-specific configuration"
          }
        },
        "required": ["name", "enabled", "priority"]
      }
    },
    "errorHandling": {
      "type": "object",
      "properties": {
        "defaultSeverity": {
          "type": "string",
          "enum": ["error", "warning", "info"]
        },
        "severityOverrides": {
          "type": "object",
          "additionalProperties": {
            "type": "string",
            "enum": ["error", "warning", "info"]
          }
        },
        "continueOnError": {
          "type": "boolean",
          "description": "Continue validation after errors"
        }
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "format": {
          "type": "string",
          "enum": ["text", "json", "junit"]
        },
        "verbose": {
          "type": "boolean"
        },
        "colorize": {
          "type": "boolean"
        }
      }
    }
  },
  "required": ["mods", "validators"]
}
```

## Testing Requirements

### Schema Validation Tests

**File:** `tests/unit/anatomy/validation/schemas/validation-config.schema.test.js`

**Test Cases:**
1. ✅ Should accept valid minimal configuration
2. ✅ Should accept valid full configuration
3. ✅ Should reject config without mods section
4. ✅ Should reject config without validators section
5. ✅ Should reject mods without essential array
6. ✅ Should reject mods without autoDetect boolean
7. ✅ Should reject validator without name
8. ✅ Should reject validator without priority
9. ✅ Should reject invalid severity level
10. ✅ Should reject invalid output format

### Example Tests

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';

describe('Validation Configuration Schema', () => {
  let ajv;
  let schema;

  beforeEach(async () => {
    ajv = new Ajv();
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/validation-config.schema.json'
    );
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);
  });

  describe('valid configurations', () => {
    it('should accept minimal valid configuration', () => {
      const config = {
        mods: {
          essential: ['core', 'anatomy'],
          autoDetect: true,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 0,
          },
        ],
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);

      expect(valid).toBe(true);
    });

    it('should accept full configuration', () => {
      const config = {
        mods: {
          essential: ['core', 'anatomy', 'descriptors'],
          optional: ['custom-mod'],
          autoDetect: true,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 0,
            failFast: true,
            config: { custom: 'setting' },
          },
        ],
        errorHandling: {
          defaultSeverity: 'error',
          severityOverrides: {
            socket_slot_compatibility: 'warning',
          },
          continueOnError: true,
        },
        output: {
          format: 'text',
          verbose: false,
          colorize: true,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);

      expect(valid).toBe(true);
    });
  });

  describe('invalid configurations', () => {
    it('should reject config without mods section', () => {
      const config = {
        validators: [],
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);

      expect(valid).toBe(false);
    });

    it('should reject invalid severity level', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: true,
        },
        validators: [],
        errorHandling: {
          defaultSeverity: 'critical', // Invalid
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);

      expect(valid).toBe(false);
    });
  });
});
```

## Acceptance Criteria

- [ ] Schema file created in correct location
- [ ] All required properties defined
- [ ] Proper enum constraints for severity and output format
- [ ] Schema validates using AJV
- [ ] Unit tests achieve 100% coverage of schema rules
- [ ] All tests pass
- [ ] Schema follows JSON Schema Draft 07 specification
- [ ] Proper `$schema` and `id` fields set

## Related Tickets

- RECVALREF-004 (creates default config using this schema)
- RECVALREF-015 (configuration loader validates against this schema)

## References

- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md` (Phase 1.3)
- **Analysis:** `reports/recipe-validation-architecture-analysis.md` (Section: Configuration vs Hardcoded Rules)
- **Project Guidelines:** `CLAUDE.md` (JSON Schema & Validation section)
