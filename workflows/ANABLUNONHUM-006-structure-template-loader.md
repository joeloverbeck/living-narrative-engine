# ANABLUNONHUM-006: Implement StructureTemplateLoader Service

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 10-12 hours
**Dependencies**: ANABLUNONHUM-001, ANABLUNONHUM-004

## Overview

Create service to load, validate, and cache structure templates. Integrates with existing data registry and validation infrastructure.

## Technical Specifications

### File Location
- **Path**: `src/anatomy/structureTemplateLoader.js`
- **DI Token**: `IStructureTemplateLoader`
- **Interface**: Load templates by ID, cache results, validate on load

### Class Structure

```javascript
/**
 * @class StructureTemplateLoader
 * Loads and caches anatomy structure templates
 */
class StructureTemplateLoader {
  #dataRegistry;
  #validator;
  #logger;
  #templateCache;

  constructor({ dataRegistry, validator, logger }) {
    // Validate dependencies
    // Initialize cache
  }

  loadTemplate(templateId) {
    // Check cache first
    // Load from data registry
    // Validate schema
    // Cache result
    // Return template
  }

  clearCache() {
    // Clear template cache
  }

  getAllTemplateIds() {
    // Return list of available templates
  }
}

export default StructureTemplateLoader;
```

### Key Methods

1. **loadTemplate(templateId)**
   - Check cache for templateId
   - If not cached, load from dataRegistry
   - Validate against structure-template schema
   - Cache validated template
   - Return template object

2. **validateTemplate(template)**
   - Validate template structure
   - Check limbSet count constraints
   - Validate socket pattern syntax
   - Ensure orientation schemes valid
   - Return validation result

3. **clearCache()**
   - Clear template cache (for testing)

## Dependencies

- `IDataRegistry` - Access to template files
- `IAjvSchemaValidator` - Schema validation
- `ILogger` - Logging service

## Validation Rules

- Template ID must exist in data registry
- Template must pass schema validation
- Socket ID templates must contain variables
- Limb counts must be 1-100
- Orientation schemes must be valid enums

## Acceptance Criteria

- [ ] Service class created with DI pattern
- [ ] loadTemplate() implemented with caching
- [ ] Schema validation integrated
- [ ] Error handling for missing/invalid templates
- [ ] Template cache mechanism working
- [ ] Unit tests: 15+ test cases
- [ ] Integration tests with data registry
- [ ] JSDoc documentation complete

## Test Cases

- Load valid template successfully
- Cache template on first load
- Return cached template on subsequent loads
- Reject invalid template ID
- Reject template failing schema validation
- Clear cache functionality
- Get all template IDs
- Handle missing data registry entries
- Validate limbSet constraints
- Validate socket pattern syntax

## Related Files

- `src/anatomy/bodyBlueprintFactory.js` - Will use this service
- `data/schemas/anatomy.structure-template.schema.json` - Schema reference
- `tests/unit/anatomy/structureTemplateLoader.test.js` - Tests

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 4.5, Phase 2
