# ANASYSREF-005: Formalize Template Contracts with JSON Schema

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 8-12 hours
**Dependencies**: None (can be done in parallel with Phase 1)
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.2)

---

## Problem Statement

Structure templates lack **formal validation**, leading to:
- Runtime errors from invalid template configurations
- No IDE autocomplete support
- Unclear contract between templates and generators
- Template errors discovered during anatomy generation, not at load time

---

## Objective

Create and enforce **JSON Schema validation** for structure templates:
- Define formal contract for template structure
- Validate at load time (fail fast)
- Provide IDE support via schema
- Document expected structure clearly

---

## Implementation Details

### 1. Create JSON Schema

**File**: `data/schemas/anatomy/structure-template.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/anatomy/structure-template",
  "title": "Anatomy Structure Template",
  "description": "Defines socket patterns for V2 anatomy blueprints",
  "type": "object",
  "required": ["id", "socketPatterns"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9_]+:[a-z0-9_]+$",
      "description": "Template identifier in format modId:templateId"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of template purpose"
    },
    "socketPatterns": {
      "type": "array",
      "minItems": 1,
      "description": "Array of socket pattern definitions",
      "items": {
        "$ref": "#/definitions/socketPattern"
      }
    }
  },
  "definitions": {
    "socketPattern": {
      "type": "object",
      "required": ["slotType", "idTemplate", "orientationScheme"],
      "properties": {
        "slotType": {
          "type": "string",
          "description": "Type of slot being generated"
        },
        "idTemplate": {
          "type": "string",
          "description": "Template string with {index}, {orientation}, {type} variables",
          "pattern": ".*\\{(index|orientation|position|type)\\}.*"
        },
        "orientationScheme": {
          "type": "string",
          "enum": ["bilateral", "radial", "indexed", "custom", "quadrupedal"],
          "description": "How to resolve orientation values"
        },
        "allowedTypes": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "description": "Allowed entity types for this slot"
        },
        "positions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Custom position names (for 'custom' orientation scheme)"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of sockets to generate (overridden by blueprint parameters)"
        },
        "limbSet": {
          "type": "string",
          "description": "Limb set grouping for recipe pattern matching"
        }
      },
      "if": {
        "properties": { "orientationScheme": { "const": "custom" } }
      },
      "then": {
        "required": ["positions"],
        "properties": {
          "positions": { "minItems": 1 }
        }
      }
    }
  }
}
```

### 2. Schema Validation at Load Time

**File**: `src/loaders/anatomyStructureTemplateLoader.js`

```javascript
import { validateAgainstSchema } from '../validation/ajvSchemaValidator.js';
import { InvalidStructureTemplateError } from '../anatomy/errors/invalidStructureTemplateError.js';

export class AnatomyStructureTemplateLoader {
  #logger;
  #schemaValidator;

  constructor({ logger, schemaValidator }) {
    this.#logger = logger;
    this.#schemaValidator = schemaValidator;
  }

  loadTemplate(templatePath) {
    const template = this.#readTemplateFile(templatePath);

    // Validate against schema
    const validationResult = validateAgainstSchema(
      template,
      'schema://living-narrative-engine/anatomy/structure-template'
    );

    if (!validationResult.valid) {
      const errors = formatAjvErrors(validationResult.errors);
      throw new InvalidStructureTemplateError(
        `Template ${template.id} failed schema validation:\n${errors}`,
        validationResult.errors
      );
    }

    this.#logger.debug(`Structure template ${template.id} validated successfully`);
    return template;
  }
}
```

### 3. Custom Error Class

**File**: `src/anatomy/errors/invalidStructureTemplateError.js`

```javascript
export class InvalidStructureTemplateError extends Error {
  constructor(message, validationErrors = []) {
    super(message);
    this.name = 'InvalidStructureTemplateError';
    this.code = 'INVALID_STRUCTURE_TEMPLATE';
    this.validationErrors = validationErrors;
  }
}
```

---

## Testing Requirements

### Schema Validation Tests

```javascript
// tests/unit/schemas/anatomy/structureTemplateSchema.test.js
describe('Structure Template Schema', () => {
  it('should validate valid structure template', () => {
    const template = {
      id: 'anatomy:test_template',
      socketPatterns: [{
        slotType: 'tentacle',
        idTemplate: 'tentacle_{orientation}_{index}',
        orientationScheme: 'radial',
        allowedTypes: ['tentacle']
      }]
    };

    const result = validateAgainstSchema(template, 'schema://living-narrative-engine/anatomy/structure-template');
    expect(result.valid).toBe(true);
  });

  it('should reject template with invalid orientation scheme', () => {
    const template = {
      id: 'anatomy:test',
      socketPatterns: [{
        slotType: 'limb',
        idTemplate: 'limb_{index}',
        orientationScheme: 'invalid_scheme'  // Invalid!
      }]
    };

    const result = validateAgainstSchema(template, 'schema://living-narrative-engine/anatomy/structure-template');
    expect(result.valid).toBe(false);
  });

  it('should require positions for custom orientation scheme', () => {
    const template = {
      id: 'anatomy:test',
      socketPatterns: [{
        slotType: 'limb',
        idTemplate: 'limb_{orientation}',
        orientationScheme: 'custom'
        // Missing required positions array!
      }]
    };

    const result = validateAgainstSchema(template, 'schema://living-narrative-engine/anatomy/structure-template');
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

```javascript
// tests/integration/loaders/structureTemplateValidation.test.js
describe('Structure Template Loading with Validation', () => {
  it('should reject invalid template at load time', async () => {
    const loader = testBed.container.resolve('IAnatomyStructureTemplateLoader');

    // Attempt to load invalid template
    await expect(async () => {
      await loader.loadTemplate('invalid-template.json');
    }).rejects.toThrow(InvalidStructureTemplateError);
  });

  it('should load valid templates successfully', async () => {
    const loader = testBed.container.resolve('IAnatomyStructureTemplateLoader');
    const template = await loader.loadTemplate('anatomy:structure_humanoid');

    expect(template.id).toBe('anatomy:structure_humanoid');
    expect(template.socketPatterns).toBeDefined();
  });
});
```

---

## Acceptance Criteria

- [ ] JSON Schema created for structure templates
- [ ] Schema validation integrated into template loader
- [ ] InvalidStructureTemplateError class created
- [ ] All existing templates pass schema validation
- [ ] Schema tests achieve 95% coverage
- [ ] Integration tests verify load-time validation
- [ ] IDE autocomplete works with schema (VS Code)
- [ ] Documentation updated with schema reference
- [ ] Existing tests still pass

---

## Risk Assessment

**Risk Level**: 🟢 **LOW**

- Validation only, doesn't change behavior
- Easy to fix templates that fail validation
- Clear error messages guide fixes

**Mitigation**:
- Validate all existing templates before deployment
- Update templates that fail validation
- Provide migration guide if needed

---

## Definition of Done

- All acceptance criteria checked
- All existing templates validated
- Code review approved
- Tests passing
- Documentation updated
- Merged to main branch

---

**Created**: 2025-11-03
**Status**: Not Started
