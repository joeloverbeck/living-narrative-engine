# ANASYSREF-005: Formalize Template Contracts with JSON Schema

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 8-12 hours
**Dependencies**: None (can be done in parallel with Phase 1)
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.2)

---

## Problem Statement

**NOTE**: A JSON schema already exists at `data/schemas/anatomy.structure-template.schema.json`, but it may not be fully enforced at load time. This workflow focuses on ensuring the schema validation is properly integrated into the loading process.

Structure templates have partial validation, but could be improved:
- Some runtime errors from invalid template configurations still possible
- Schema validation may not be consistently enforced at load time
- Template errors could be caught earlier in the loading process

---

## Objective

Ensure **JSON Schema validation** is properly enforced for structure templates:
- Verify existing schema at `data/schemas/anatomy.structure-template.schema.json` is comprehensive
- Ensure validation occurs at load time in `anatomyStructureTemplateLoader.js` (fail fast)
- Verify IDE support via schema is working
- Ensure error handling provides clear feedback

---

## Implementation Details

### 1. Verify Existing JSON Schema

**File**: `data/schemas/anatomy.structure-template.schema.json` (ALREADY EXISTS)

**Schema ID**: `schema://living-narrative-engine/anatomy.structure-template.schema.json`

The existing schema defines the structure template format:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "title": "Anatomy Structure Template",
  "description": "Parameterized body structure definition for generating anatomy blueprints",
  "type": "object",
  "required": ["id", "topology"],
  "properties": {
    "id": {
      "$ref": "./common.schema.json#/definitions/namespacedId",
      "description": "Unique identifier (e.g., 'anatomy:structure_humanoid')"
    },
    "description": {
      "type": "string",
      "minLength": 10,
      "description": "Human-readable description"
    },
    "topology": {
      "type": "object",
      "required": ["rootType"],
      "properties": {
        "rootType": {
          "type": "string",
          "description": "Root body part type (e.g., 'torso', 'cephalothorax')"
        },
        "limbSets": {
          "type": "array",
          "description": "Limb set definitions (legs, arms, tentacles, wings)",
          "items": {
            "type": "object",
            "required": ["type", "count", "socketPattern"],
            "properties": {
              "type": { "type": "string" },
              "count": { "type": "integer", "minimum": 1, "maximum": 100 },
              "arrangement": {
                "enum": ["bilateral", "radial", "quadrupedal", "linear", "custom"]
              },
              "socketPattern": {
                "$ref": "#/definitions/socketPattern"
              }
            }
          }
        },
        "appendages": {
          "type": "array",
          "description": "Appendage definitions (head, tail, abdomen)",
          "items": {
            "type": "object",
            "required": ["type", "count", "attachment", "socketPattern"],
            "properties": {
              "type": { "type": "string" },
              "count": { "type": "integer", "minimum": 1, "maximum": 10 },
              "attachment": {
                "enum": ["anterior", "posterior", "dorsal", "ventral", "lateral", "custom"]
              },
              "socketPattern": {
                "$ref": "#/definitions/socketPattern"
              }
            }
          }
        }
      }
    }
  },
  "definitions": {
    "socketPattern": {
      "type": "object",
      "required": ["idTemplate", "allowedTypes"],
      "properties": {
        "idTemplate": {
          "type": "string",
          "pattern": "^[a-z_]+(\\{\\{[a-z_]+\\}\\}.*)?$",
          "description": "Template with {{index}}, {{orientation}}, {{position}} variables"
        },
        "orientationScheme": {
          "enum": ["bilateral", "radial", "indexed", "custom"],
          "default": "indexed",
          "description": "How orientations are computed"
        },
        "allowedTypes": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        },
        "positions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Explicit position names for custom arrangements"
        }
      }
    }
  }
}
```

**Key Structure Notes**:
- Templates use `topology: { rootType, limbSets[], appendages[] }` structure
- Socket patterns nested inside limbSets and appendages
- Template variables use **double braces**: `{{index}}`, `{{orientation}}`, `{{position}}`
- Orientation schemes in socketPattern: `bilateral`, `radial`, `indexed`, `custom` (no quadrupedal here)
- Arrangement in limbSets supports: `bilateral`, `radial`, `quadrupedal`, `linear`, `custom`

### 2. Enhance Schema Validation at Load Time

**File**: `src/loaders/anatomyStructureTemplateLoader.js` (ALREADY EXISTS)

The loader already exists and extends `SimpleItemLoader`. It has manual validation in `_processFetchedItem`. We should enhance it to use schema validation:

```javascript
// Existing imports at top of file
import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { ValidationError } from '../errors/validationError.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';
import { formatAjvErrors } from '../utils/ajvUtils.js';

class AnatomyStructureTemplateLoader extends SimpleItemLoader {
  constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
    super(
      'anatomyStructureTemplates',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy structure template file's data.
   * @override
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `AnatomyStructureTemplateLoader [${modId}]: Processing ${filename}`
    );

    // First validate against JSON schema
    try {
      validateAgainstSchema(
        this._schemaValidator,
        'schema://living-narrative-engine/anatomy.structure-template.schema.json',
        data,
        this._logger,
        {
          validationDebugMessage: `Validating structure template from ${filename}`,
          failureMessage: `Structure template '${filename}' from mod '${modId}' failed schema validation`,
          failureThrowMessage: `Invalid structure template in '${filename}' from mod '${modId}'`,
          filePath: resolvedPath
        }
      );
    } catch (validationError) {
      // Schema validation throws on failure, re-throw as ValidationError
      throw new ValidationError(
        `Structure template schema validation failed: ${validationError.message}`,
        data.id,
        validationError
      );
    }

    // Manual validation (kept for backward compatibility and additional checks)
    if (!data.id) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'id' field.`
      );
    }
    if (!data.topology) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'topology' field.`
      );
    }
    if (!data.topology.rootType) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'topology.rootType' field.`
      );
    }

    // Validate limb sets if present
    if (data.topology.limbSets && Array.isArray(data.topology.limbSets)) {
      this._validateLimbSets(data.topology.limbSets, modId, filename);
    }

    // Validate appendages if present
    if (data.topology.appendages && Array.isArray(data.topology.appendages)) {
      this._validateAppendages(data.topology.appendages, modId, filename);
    }

    // Store the template in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomyStructureTemplates',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyStructureTemplateLoader [${modId}]: Successfully processed ${filename}. Registry key: ${qualifiedId}`
    );

    return { qualifiedId, didOverride };
  }

  // _validateLimbSets, _validateAppendages, _validateSocketPattern methods remain unchanged
}
```

**Key Changes**:
- Import `validateAgainstSchema` from `../utils/schemaValidationUtils.js` (not from validator)
- Import `formatAjvErrors` from `../utils/ajvUtils.js`
- Call `validateAgainstSchema(validator, schemaId, data, logger, context)` with correct signature
- Use correct schema ID: `schema://living-narrative-engine/anatomy.structure-template.schema.json`
- Throw `ValidationError` (existing error class) instead of custom error
- Keep existing manual validation for backward compatibility

### 3. Error Handling

**No custom error class needed** - use existing `ValidationError` from `src/errors/validationError.js`

The existing `ValidationError` class already handles validation failures:

```javascript
// From src/errors/validationError.js
export class ValidationError extends BaseError {
  constructor(message, componentTypeId = null, validationErrors = null) {
    super(message, 'VALIDATION_ERROR', { componentTypeId, validationErrors });
    this.name = 'ValidationError';
    this.componentTypeId = componentTypeId;
    this.validationErrors = validationErrors;
  }
}
```

**Usage in loader**:
```javascript
import { ValidationError } from '../errors/validationError.js';

throw new ValidationError(
  `Structure template schema validation failed: ${error.message}`,
  data.id,
  validationErrors
);
```

If a more specific error is needed, follow the pattern of `BodyDescriptorValidationError` which extends `ValidationError`:

```javascript
// src/anatomy/errors/structureTemplateValidationError.js (OPTIONAL)
import { ValidationError } from '../../errors/validationError.js';

export class StructureTemplateValidationError extends ValidationError {
  constructor(message, templateId = null, validationErrors = null) {
    super(message, templateId, validationErrors);
    this.name = 'StructureTemplateValidationError';
  }
}
```

---

## Testing Requirements

### Schema Validation Tests

```javascript
// tests/unit/loaders/anatomyStructureTemplateLoader.schemaValidation.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('AnatomyStructureTemplateLoader - Schema Validation', () => {
  let testBed;
  let loader;
  let schemaValidator;

  beforeEach(() => {
    testBed = createTestBed();
    schemaValidator = testBed.getMockSchemaValidator();
    loader = testBed.getLoader('anatomyStructureTemplates');
  });

  it('should validate valid structure template with limbSets', async () => {
    const template = {
      id: 'anatomy:test_template',
      description: 'Test template for validation',
      topology: {
        rootType: 'torso',
        limbSets: [{
          type: 'tentacle',
          count: 8,
          arrangement: 'radial',
          socketPattern: {
            idTemplate: 'tentacle_{{index}}',
            orientationScheme: 'indexed',
            allowedTypes: ['tentacle']
          }
        }]
      }
    };

    // Mock schema validator to return valid
    schemaValidator.validate.mockReturnValue({ isValid: true, errors: null });

    const result = await loader._processFetchedItem(
      'test_mod',
      'test.json',
      '/path/to/test.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(result.qualifiedId).toBe('test_mod:test_template');
  });

  it('should reject template with invalid orientation scheme', async () => {
    const template = {
      id: 'anatomy:test',
      description: 'Test template with invalid scheme',
      topology: {
        rootType: 'torso',
        limbSets: [{
          type: 'limb',
          count: 4,
          socketPattern: {
            idTemplate: 'limb_{{index}}',
            orientationScheme: 'invalid_scheme',  // Invalid!
            allowedTypes: ['limb']
          }
        }]
      }
    };

    // Mock schema validator to return invalid
    schemaValidator.validate.mockReturnValue({
      isValid: false,
      errors: [{
        instancePath: '/topology/limbSets/0/socketPattern/orientationScheme',
        message: 'must be equal to one of the allowed values'
      }]
    });

    await expect(async () => {
      await loader._processFetchedItem(
        'test_mod',
        'test.json',
        '/path/to/test.json',
        template,
        'anatomyStructureTemplates'
      );
    }).rejects.toThrow(/schema validation failed/);
  });

  it('should validate template with appendages', async () => {
    const template = {
      id: 'anatomy:test_appendage',
      description: 'Test template with appendages',
      topology: {
        rootType: 'cephalothorax',
        appendages: [{
          type: 'head',
          count: 1,
          attachment: 'anterior',
          socketPattern: {
            idTemplate: 'head',
            allowedTypes: ['head']
          }
        }]
      }
    };

    schemaValidator.validate.mockReturnValue({ isValid: true, errors: null });

    const result = await loader._processFetchedItem(
      'test_mod',
      'test.json',
      '/path/to/test.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(result.qualifiedId).toBe('test_mod:test_appendage');
  });

  it('should validate template variable syntax uses double braces', () => {
    const template = {
      id: 'anatomy:test',
      description: 'Test double brace syntax',
      topology: {
        rootType: 'torso',
        limbSets: [{
          type: 'leg',
          count: 2,
          socketPattern: {
            idTemplate: 'leg_{{orientation}}_{{index}}',  // Double braces!
            orientationScheme: 'bilateral',
            allowedTypes: ['leg']
          }
        }]
      }
    };

    // Pattern should match: ^[a-z_]+(\\{\\{[a-z_]+\\}\\}.*)?$
    expect(template.topology.limbSets[0].socketPattern.idTemplate).toMatch(/\{\{[a-z_]+\}\}/);
  });
});
```

**Key Test Corrections**:
- Use correct template structure: `topology: { rootType, limbSets[], appendages[] }`
- Template variables use **double braces**: `{{index}}`, not `{index}`
- Correct schema ID: `schema://living-narrative-engine/anatomy.structure-template.schema.json`
- Test file location: `tests/unit/loaders/` (not `tests/unit/schemas/`)
- Use `testBed` pattern for mocking
- Test async `_processFetchedItem` method

### Integration Tests

```javascript
// tests/integration/loaders/anatomyStructureTemplateLoader.integration.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Structure Template Loading with Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reject invalid template at load time', async () => {
    const invalidTemplate = {
      id: 'anatomy:invalid',
      // Missing required topology field
    };

    const loader = testBed.getLoader('anatomyStructureTemplates');

    await expect(async () => {
      await loader._processFetchedItem(
        'test_mod',
        'invalid.json',
        '/path/to/invalid.json',
        invalidTemplate,
        'anatomyStructureTemplates'
      );
    }).rejects.toThrow(/topology/);
  });

  it('should load valid octopoid template successfully', async () => {
    const registry = testBed.getDataRegistry();

    // Load actual template from data
    const template = registry.getItem('anatomyStructureTemplates', 'anatomy:structure_octopoid');

    expect(template).toBeDefined();
    expect(template.id).toBe('anatomy:structure_octopoid');
    expect(template.topology).toBeDefined();
    expect(template.topology.rootType).toBe('mantle');
    expect(template.topology.limbSets).toBeDefined();
    expect(template.topology.limbSets.length).toBeGreaterThan(0);

    // Verify socket pattern structure
    const firstLimbSet = template.topology.limbSets[0];
    expect(firstLimbSet.socketPattern).toBeDefined();
    expect(firstLimbSet.socketPattern.idTemplate).toBeDefined();
    expect(firstLimbSet.socketPattern.allowedTypes).toBeDefined();
    expect(Array.isArray(firstLimbSet.socketPattern.allowedTypes)).toBe(true);
  });

  it('should validate all existing structure templates', async () => {
    const registry = testBed.getDataRegistry();
    const templates = registry.getAllItems('anatomyStructureTemplates');

    expect(templates.size).toBeGreaterThan(0);

    // All loaded templates should have valid structure
    for (const [id, template] of templates) {
      expect(template.id).toBe(id);
      expect(template.topology).toBeDefined();
      expect(template.topology.rootType).toBeDefined();

      // Validate limbSets if present
      if (template.topology.limbSets) {
        for (const limbSet of template.topology.limbSets) {
          expect(limbSet.type).toBeDefined();
          expect(limbSet.count).toBeGreaterThan(0);
          expect(limbSet.socketPattern).toBeDefined();
          expect(limbSet.socketPattern.idTemplate).toBeDefined();
          expect(limbSet.socketPattern.allowedTypes).toBeDefined();
        }
      }

      // Validate appendages if present
      if (template.topology.appendages) {
        for (const appendage of template.topology.appendages) {
          expect(appendage.type).toBeDefined();
          expect(appendage.count).toBeGreaterThan(0);
          expect(appendage.attachment).toBeDefined();
          expect(appendage.socketPattern).toBeDefined();
        }
      }
    }
  });
});
```

**Key Integration Test Corrections**:
- Use `testBed.getLoader()` and `testBed.getDataRegistry()` patterns
- Test actual templates like `anatomy:structure_octopoid`
- Validate `topology` structure, not `socketPatterns`
- Check `topology.rootType`, `topology.limbSets`, `topology.appendages`
- Verify socket patterns are nested in limbSets/appendages
- Test file location: `tests/integration/loaders/`

---

## Acceptance Criteria

- [ ] Verify JSON Schema at `data/schemas/anatomy.structure-template.schema.json` is comprehensive
- [ ] Schema validation properly integrated into `anatomyStructureTemplateLoader.js`
- [ ] Use existing `ValidationError` class (no custom error needed unless beneficial)
- [ ] All existing templates pass schema validation (octopoid, arachnid, etc.)
- [ ] Schema validation tests added to `tests/unit/loaders/anatomyStructureTemplateLoader.schemaValidation.test.js`
- [ ] Integration tests verify load-time validation in `tests/integration/loaders/`
- [ ] IDE autocomplete works with schema (VS Code) - verify `$schema` references
- [ ] Loader correctly validates template structure: `topology: { rootType, limbSets[], appendages[] }`
- [ ] Template variable syntax validated: `{{index}}`, `{{orientation}}`, `{{position}}` (double braces)
- [ ] Orientation schemes validated: `bilateral`, `radial`, `indexed`, `custom`
- [ ] Existing tests still pass
- [ ] Test coverage for loader validation logic at 90%+

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
- All existing templates validated against schema
- Schema validation integrated into loader
- Code review approved
- All tests passing (unit, integration, existing)
- ESLint passing on modified files
- Test coverage maintained at 90%+ for loader
- Documentation updated if needed
- Merged to main branch

---

## Codebase Reality Check - Corrections Made

This workflow was analyzed and corrected to match actual codebase structure:

### Critical Corrections:
1. **Schema Already Exists**: `data/schemas/anatomy.structure-template.schema.json` (not `data/schemas/anatomy/structure-template.schema.json`)
2. **Schema ID**: `schema://living-narrative-engine/anatomy.structure-template.schema.json` (not `schema://living-narrative-engine/anatomy/structure-template`)
3. **Template Structure**: Uses `topology: { rootType, limbSets[], appendages[] }` (not flat `socketPatterns[]`)
4. **Template Variables**: Use `{{index}}`, `{{orientation}}`, `{{position}}` (double braces, not single)
5. **validateAgainstSchema**: Signature is `(validator, schemaId, data, logger, context)`, imported from `../utils/schemaValidationUtils.js`
6. **formatAjvErrors**: Import from `../utils/ajvUtils.js`
7. **Error Class**: Use existing `ValidationError` from `../errors/validationError.js` (not custom `InvalidStructureTemplateError`)
8. **Loader Exists**: `anatomyStructureTemplateLoader.js` already exists with validation
9. **Orientation Schemes**: socketPattern supports `bilateral`, `radial`, `indexed`, `custom` (no quadrupedal); limbSet arrangement supports `bilateral`, `radial`, `quadrupedal`, `linear`, `custom`
10. **Test Locations**: `tests/unit/loaders/` and `tests/integration/loaders/` (not `tests/unit/schemas/`)

### Files Referenced (Verified to Exist):
- `/home/user/living-narrative-engine/data/schemas/anatomy.structure-template.schema.json`
- `/home/user/living-narrative-engine/src/loaders/anatomyStructureTemplateLoader.js`
- `/home/user/living-narrative-engine/src/utils/schemaValidationUtils.js`
- `/home/user/living-narrative-engine/src/utils/ajvUtils.js`
- `/home/user/living-narrative-engine/src/errors/validationError.js`
- `/home/user/living-narrative-engine/src/validation/ajvSchemaValidator.js`

### Example Templates (Verified):
- `data/mods/anatomy/structure-templates/structure_octopoid.structure-template.json`
- `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`

---

**Created**: 2025-11-03
**Updated**: 2025-11-05 (Validated against codebase)
**Status**: Ready for Implementation
