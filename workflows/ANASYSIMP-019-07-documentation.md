# ANASYSIMP-019-07: Documentation

**Phase:** 4 (Documentation & Rollout)
**Timeline:** 0.5-1 day
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-06 (Evaluate and Refine)
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Create comprehensive documentation for the schema-driven validation generation system. This documentation will enable developers to understand, use, and maintain the validation rules system.

## Objectives

1. Document `validationRules` specification
2. Create migration guide for developers
3. Update component schema documentation
4. Add examples to anatomy documentation
5. Document validator generation architecture
6. Create troubleshooting guide
7. Update CLAUDE.md with new patterns
8. Provide best practices and guidelines

## Technical Details

### 1. ValidationRules Specification

**File to Create:** `docs/validation/validation-rules-specification.md`

```markdown
# ValidationRules Specification

## Overview

The `validationRules` property in component schemas enables automatic generation of validators with enhanced error messages and helpful suggestions.

## Schema Structure

### Top-Level Properties

```json
{
  "validationRules": {
    "generateValidator": boolean,
    "errorMessages": { ... },
    "suggestions": { ... }
  }
}
```

#### generateValidator

- **Type:** `boolean`
- **Required:** No
- **Default:** `false`
- **Description:** Whether to generate a validator for this schema

#### errorMessages

- **Type:** `object`
- **Required:** No
- **Description:** Custom error message templates

**Properties:**

##### invalidEnum

- **Type:** `string`
- **Description:** Template for enum validation failures
- **Variables:** `{{property}}`, `{{value}}`, `{{validValues}}`
- **Example:** `"Invalid {{property}}: {{value}}. Valid options: {{validValues}}"`

##### missingRequired

- **Type:** `string`
- **Description:** Template for required field failures
- **Variables:** `{{field}}`
- **Example:** `"Missing required field: {{field}}"`

##### invalidType

- **Type:** `string`
- **Description:** Template for type validation failures
- **Variables:** `{{field}}`, `{{expected}}`, `{{actual}}`
- **Example:** `"Invalid type for {{field}}: expected {{expected}}, got {{actual}}"`

#### suggestions

- **Type:** `object`
- **Required:** No
- **Description:** Configuration for value suggestions

**Properties:**

##### enableSimilarity

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable similarity-based suggestions for enum values

##### maxDistance

- **Type:** `integer`
- **Default:** `3`
- **Range:** 1-10
- **Description:** Maximum Levenshtein distance for suggestions

##### maxSuggestions

- **Type:** `integer`
- **Default:** `3`
- **Range:** 1-10
- **Description:** Maximum number of suggestions to provide

## Complete Example

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "description": "Surface texture descriptor",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "enum": ["smooth", "rough", "bumpy", "scaly"],
        "default": "smooth"
      }
    },
    "required": ["texture"]
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture '{{value}}'. Valid options: {{validValues}}",
      "missingRequired": "Texture is required",
      "invalidType": "Texture must be a string"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

## Template Variables

### Available Variables

| Variable | Context | Description |
|----------|---------|-------------|
| `{{property}}` | invalidEnum | Property name |
| `{{value}}` | invalidEnum | Invalid value provided |
| `{{validValues}}` | invalidEnum | Comma-separated valid values |
| `{{field}}` | missingRequired, invalidType | Field name |
| `{{expected}}` | invalidType | Expected type |
| `{{actual}}` | invalidType | Actual type received |

## Best Practices

### Error Message Templates

1. **Be specific:** Include the property name and invalid value
2. **Be helpful:** List valid options or provide guidance
3. **Be concise:** Keep messages under 100 characters when possible
4. **Be consistent:** Follow the same format across similar components

### Suggestion Configuration

1. **Use maxDistance: 3** for most cases (catches most typos)
2. **Increase maxDistance** for longer value strings
3. **Limit maxSuggestions to 3-5** to avoid overwhelming users
4. **Enable similarity** unless performance is critical

### When to Use ValidationRules

✅ **Good candidates:**
- Components with enum properties
- Components with common typos
- Components with many valid values
- Components validated frequently

❌ **Not needed:**
- Simple boolean flags
- Freeform string/number fields
- Components validated once at load
- Performance-critical hot paths

## See Also

- [Migration Guide](./migration-guide.md)
- [Component Schema Specification](../schemas/component-schema-spec.md)
- [Validator Generator Architecture](./validator-generator-architecture.md)
```

### 2. Migration Guide

**File to Create:** `docs/validation/migration-guide.md`

```markdown
# Schema-Driven Validation Migration Guide

## Overview

This guide walks through migrating component schemas to use `validationRules` for enhanced validation.

## Prerequisites

- Familiarity with JSON Schema
- Understanding of component schemas
- Git for version control

## Migration Process

### Step 1: Analyze Schemas

Run the schema analyzer to identify candidates:

```bash
npm run migrate:analyze
```

This generates `migration-analysis.json` with details about:
- Total schemas
- Schemas with enums (candidates)
- Already migrated schemas

### Step 2: Preview Changes

Generate validation rules in dry-run mode:

```bash
npm run migrate:generate
```

Review the proposed changes carefully.

### Step 3: Apply Changes

If satisfied with the preview, apply changes:

```bash
npm run migrate:generate:apply
```

### Step 4: Validate Migration

Ensure all schemas still validate:

```bash
npm run migrate:validate
npm run validate
```

### Step 5: Test

Run your test suite to ensure no regressions:

```bash
npm run test:ci
```

## Manual Migration

For more control, migrate schemas manually:

### Example: Texture Descriptor

**Before:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "enum": ["smooth", "rough", "bumpy"]
      }
    },
    "required": ["texture"]
  }
}
```

**After:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "enum": ["smooth", "rough", "bumpy"]
      }
    },
    "required": ["texture"]
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture '{{value}}'. Valid: {{validValues}}",
      "missingRequired": "Texture is required"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

## Common Patterns

### Pattern 1: Descriptor with Enums

Use for: color, texture, shape, size, material

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{property}}: {{value}}. Valid options: {{validValues}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

### Pattern 2: Required Fields Emphasis

Use when: Missing fields cause critical errors

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{property}}: {{value}}",
      "missingRequired": "⚠️ {{field}} is REQUIRED for this component"
    }
  }
}
```

### Pattern 3: Type Safety

Use when: Type errors are common

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidType": "{{field}} must be {{expected}}, not {{actual}}"
    }
  }
}
```

## Troubleshooting

### Issue: Schemas don't validate after migration

**Solution:** Run validation checker:

```bash
npm run migrate:validate
```

Check for:
- Missing commas
- Invalid JSON
- Incorrect template variables

### Issue: Suggestions are inaccurate

**Solution:** Adjust `maxDistance`:

```json
{
  "suggestions": {
    "maxDistance": 2  // More strict
  }
}
```

### Issue: Performance degradation

**Solution:**
1. Check validator cache is enabled
2. Pre-generate validators at startup
3. Disable for hot-path components

## Rollback

If migration causes issues:

```bash
# Revert specific schema
git checkout HEAD -- path/to/schema.json

# Revert all schemas
git checkout HEAD -- data/mods/*/components/

# Disable validator generation
# Set generateValidator: false in schemas
```

## Next Steps

- Read [ValidationRules Specification](./validation-rules-specification.md)
- Review [Best Practices](./validation-best-practices.md)
- Check [Troubleshooting Guide](./validation-troubleshooting.md)
```

### 3. Update Component Schema Documentation

**File to Update:** `docs/schemas/component-schema-spec.md`

Add section about `validationRules` property:

```markdown
## validationRules (Optional)

The `validationRules` property enables automatic generation of enhanced validators.

**Type:** `object`

**Properties:**
- `generateValidator`: Enable validator generation
- `errorMessages`: Custom error message templates
- `suggestions`: Suggestion configuration

**See:** [ValidationRules Specification](../validation/validation-rules-specification.md)

**Example:**

[Include example]
```

### 4. Update CLAUDE.md

**File to Update:** `CLAUDE.md`

Add section in appropriate location:

```markdown
### Schema-Driven Validation

Component schemas support optional `validationRules` for enhanced validation:

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{property}}: {{value}}. Valid: {{validValues}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

**Documentation:** `docs/validation/validation-rules-specification.md`

**Migration:** Use `npm run migrate:analyze` and `npm run migrate:generate`
```

### 5. Validator Generator Architecture Documentation

**File to Create:** `docs/validation/validator-generator-architecture.md`

Document the technical architecture, design decisions, and internals for future maintainers.

### 6. Best Practices Guide

**File to Create:** `docs/validation/validation-best-practices.md`

Document best practices for writing validation rules, choosing error messages, and maintaining schemas.

### 7. Troubleshooting Guide

**File to Create:** `docs/validation/validation-troubleshooting.md`

Document common issues and their solutions.

## Files to Create

- [ ] `docs/validation/validation-rules-specification.md`
- [ ] `docs/validation/migration-guide.md`
- [ ] `docs/validation/validator-generator-architecture.md`
- [ ] `docs/validation/validation-best-practices.md`
- [ ] `docs/validation/validation-troubleshooting.md`

## Files to Update

- [ ] `docs/schemas/component-schema-spec.md` - Add validationRules section
- [ ] `CLAUDE.md` - Add schema-driven validation pattern
- [ ] `README.md` - Mention validation improvements (if relevant)

## Acceptance Criteria

- [ ] ValidationRules specification complete and clear
- [ ] Migration guide enables developers to migrate schemas
- [ ] Component schema documentation updated
- [ ] CLAUDE.md updated with new patterns
- [ ] Architecture documentation complete
- [ ] Best practices documented
- [ ] Troubleshooting guide covers common issues
- [ ] All examples are tested and working
- [ ] Documentation is clear and concise
- [ ] Cross-references are correct

## Validation Commands

```bash
# Verify documentation links
npm run docs:check-links

# Verify examples in documentation
npm run docs:verify-examples

# Build and serve docs
npm run docs:serve
```

## Success Metrics

- ✅ Developers can migrate schemas without assistance
- ✅ Documentation answers common questions
- ✅ Examples are clear and runnable
- ✅ Architecture is understandable for maintainers
- ✅ Zero ambiguity in specification

## Documentation Standards

### Formatting

- Use markdown for all documentation
- Include code examples with syntax highlighting
- Use tables for comparison and reference
- Include diagrams where helpful

### Structure

1. **Overview** - What is it?
2. **Quick Start** - How do I use it?
3. **Reference** - What are all the options?
4. **Examples** - Show me common patterns
5. **Troubleshooting** - Help me fix problems

### Code Examples

- Test all code examples
- Include both good and bad examples
- Show expected output
- Explain non-obvious code

### Cross-References

- Link to related documentation
- Reference source code when relevant
- Maintain bidirectional links

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-06 (Evaluate and Refine)
- **Supports:** ANASYSIMP-019-08 (Gradual Rollout)

## References

- **Existing Validation Docs:** `docs/anatomy/validation-workflow.md`
- **Component Schema Docs:** `docs/schemas/component-schema-spec.md` (if exists)
- **CLAUDE.md:** Project-wide development guide
