# RECVALREF-004: Create Default Validation Configuration

**Phase:** 1 - Foundation & Interfaces
**Priority:** P0 - Critical
**Estimated Effort:** 1 hour
**Dependencies:** RECVALREF-003

## Context

With the configuration schema in place (RECVALREF-003), we need a default configuration file that:
- Mirrors current hardcoded validation behavior
- Provides sensible defaults for all validators
- Serves as reference for custom configurations
- Maintains backward compatibility with existing validation flow

## Objectives

1. Create default `validation-config.json` file
2. Configure all 11 validators with appropriate priorities
3. Set severity overrides matching current behavior
4. Document configuration options
5. Ensure schema validation passes

## Implementation Details

### File to Create

`config/validation-config.json`

### Default Configuration

```json
{
  "mods": {
    "essential": ["core", "descriptors", "anatomy"],
    "optional": [],
    "autoDetect": true
  },
  "validators": [
    {
      "name": "component_existence",
      "enabled": true,
      "priority": 0,
      "failFast": true
    },
    {
      "name": "property_schemas",
      "enabled": true,
      "priority": 1,
      "failFast": true
    },
    {
      "name": "body_descriptors",
      "enabled": true,
      "priority": 2,
      "failFast": true
    },
    {
      "name": "blueprint_exists",
      "enabled": true,
      "priority": 3,
      "failFast": true
    },
    {
      "name": "socket_slot_compatibility",
      "enabled": true,
      "priority": 4,
      "failFast": false
    },
    {
      "name": "pattern_matching",
      "enabled": true,
      "priority": 5,
      "failFast": false,
      "config": {
        "skipIfDisabled": true
      }
    },
    {
      "name": "descriptor_coverage",
      "enabled": true,
      "priority": 6,
      "failFast": false
    },
    {
      "name": "part_availability",
      "enabled": true,
      "priority": 7,
      "failFast": false
    },
    {
      "name": "generated_slot_parts",
      "enabled": true,
      "priority": 8,
      "failFast": false
    },
    {
      "name": "load_failures",
      "enabled": true,
      "priority": 9,
      "failFast": false
    },
    {
      "name": "recipe_usage",
      "enabled": true,
      "priority": 10,
      "failFast": false
    }
  ],
  "errorHandling": {
    "defaultSeverity": "error",
    "severityOverrides": {
      "socket_slot_compatibility": "warning",
      "descriptor_coverage": "info",
      "recipe_usage": "info"
    },
    "continueOnError": true
  },
  "output": {
    "format": "text",
    "verbose": false,
    "colorize": true
  }
}
```

## Validation Mapping

This configuration maps to current behavior:

| Validator | Current Behavior | Config Priority | Fail Fast | Severity Override |
|-----------|------------------|-----------------|-----------|-------------------|
| Component Existence | P0 - Critical | 0 | true | error (default) |
| Property Schemas | P0 - Critical | 1 | true | error (default) |
| Body Descriptors | P0 - Critical | 2 | true | error (default) |
| Blueprint Exists | P0 - Critical | 3 | true | error (default) |
| Socket/Slot Compatibility | P1 - High | 4 | false | **warning** |
| Pattern Matching | P1 - High | 5 | false | error (default) |
| Descriptor Coverage | P2 - Medium | 6 | false | **info** |
| Part Availability | P2 - Medium | 7 | false | error (default) |
| Generated Slot Parts | P2 - Medium | 8 | false | error (default) |
| Load Failures | P3 - Low | 9 | false | error (default) |
| Recipe Usage | P4 - Informational | 10 | false | **info** |

## Testing Requirements

### Configuration Validation Test

**File:** `tests/unit/config/validation-config.test.js`

**Test Cases:**
1. ✅ Should be valid according to schema
2. ✅ Should contain all 11 validators
3. ✅ Should have essential mods configured
4. ✅ Should have autoDetect enabled
5. ✅ Should set appropriate severity overrides
6. ✅ Should configure fail-fast validators (0-3)
7. ✅ Should not fail-fast for lower priority validators

### Example Tests

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';

describe('Default Validation Configuration', () => {
  let config;
  let schema;
  let ajv;

  beforeEach(async () => {
    // Load configuration
    const configPath = path.join(process.cwd(), 'config/validation-config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);

    // Load schema
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/validation-config.schema.json'
    );
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);

    ajv = new Ajv();
  });

  it('should be valid according to schema', () => {
    const validate = ajv.compile(schema);
    const valid = validate(config);

    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }

    expect(valid).toBe(true);
  });

  it('should contain all 11 validators', () => {
    expect(config.validators).toHaveLength(11);
  });

  it('should have essential mods configured', () => {
    expect(config.mods.essential).toEqual(['core', 'descriptors', 'anatomy']);
  });

  it('should enable autoDetect for mod loading', () => {
    expect(config.mods.autoDetect).toBe(true);
  });

  it('should set severity overrides for specific validators', () => {
    expect(config.errorHandling.severityOverrides).toEqual({
      socket_slot_compatibility: 'warning',
      descriptor_coverage: 'info',
      recipe_usage: 'info',
    });
  });

  it('should configure fail-fast for critical validators', () => {
    const failFastValidators = config.validators.filter((v) => v.failFast);
    const failFastNames = failFastValidators.map((v) => v.name);

    expect(failFastNames).toEqual([
      'component_existence',
      'property_schemas',
      'body_descriptors',
      'blueprint_exists',
    ]);
  });

  it('should order validators by priority', () => {
    const priorities = config.validators.map((v) => v.priority);
    const sortedPriorities = [...priorities].sort((a, b) => a - b);

    expect(priorities).toEqual(sortedPriorities);
  });
});
```

## Acceptance Criteria

- [ ] Configuration file created in correct location
- [ ] All 11 validators configured with correct priorities
- [ ] Severity overrides match current behavior
- [ ] Fail-fast flags match current critical checks
- [ ] Essential mods configured (core, descriptors, anatomy)
- [ ] Configuration validates against schema
- [ ] Unit tests pass
- [ ] Configuration follows JSON formatting standards

## Environment Configuration

This default configuration should be used in all environments unless overridden by:
- Environment-specific config file (e.g., `validation-config.dev.json`)
- CLI flags (future enhancement)
- User-provided config path

## Related Tickets

- RECVALREF-003 (prerequisite - schema definition)
- RECVALREF-015 (will load and validate this configuration)

## References

- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md` (Phase 1.4)
- **Analysis:** `reports/recipe-validation-architecture-analysis.md` (Section: Boolean Flag Proliferation)
- **Current Implementation:** `src/anatomy/validation/RecipePreflightValidator.js:95-149` (validation check ordering)
