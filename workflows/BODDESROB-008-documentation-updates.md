# BODDESROB-008: Update Documentation for Body Descriptor Registry

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 4 (Documentation)
**Estimated Effort**: 1 day
**Dependencies**: BODDESROB-001, BODDESROB-002, BODDESROB-003, BODDESROB-007

## Workflow Validation Summary

**Validated**: 2025-11-06

This workflow has been validated against the actual codebase. Key corrections made:

1. **Corrected File Paths**:
   - Architecture doc is at `docs/anatomy/architecture.md` (not `docs/architecture/anatomy-system.md`)
   - Development guide is `anatomy-development-guide.md` (not `anatomy-development.md`)

2. **Identified Existing Documentation**:
   - `docs/migration/body-descriptor-migration.md` already exists (comprehensive migration guide)
   - `docs/development/body-descriptors-technical.md` already exists (technical details)
   - `docs/development/anatomy-development-guide.md` already exists (general guide)
   - `docs/anatomy/architecture.md` already exists (architecture overview)

3. **Corrected Approach**: Changed from "create from scratch" to "enhance existing and create registry-specific" documentation

4. **Added Implementation Details**: Documented actual registry exports, methods, descriptor count (6), and display orders (10-60, next: 70)

5. **Clarified Locations**: Added complete file paths for registry, validator, schema, config, tests, and CLI tool

## Overview

Update all project documentation to reflect the new body descriptor registry architecture. This includes technical documentation, developer guides, architecture docs, and user-facing documentation.

## Problem Context

After implementing the registry system, documentation needs to be updated to:
- Explain the new registry architecture
- Guide developers on adding new descriptors using the registry
- Document validation tools and processes
- Update CLAUDE.md with architectural changes
- Provide examples and best practices

**Important Note**: Substantial documentation already exists for the body descriptor system:
- `docs/migration/body-descriptor-migration.md` - Comprehensive migration guide
- `docs/development/body-descriptors-technical.md` - Technical implementation details
- `docs/development/anatomy-development-guide.md` - General anatomy development guide
- `docs/anatomy/architecture.md` - Anatomy system architecture

This ticket focuses on **enhancing existing documentation** and creating **registry-specific** documentation to complement what's already in place. The goal is to integrate registry concepts throughout the documentation ecosystem rather than creating entirely new documentation from scratch.

## Acceptance Criteria

- [ ] Architecture documentation updated with registry pattern
- [ ] Developer guide created for adding body descriptors
- [ ] Technical documentation updated for all new components
- [ ] README.md updated with validation tool usage
- [ ] CLAUDE.md updated with registry architecture
- [ ] Examples and code snippets updated
- [ ] Migration guide created for existing code
- [ ] All documentation reviewed for accuracy
- [ ] Links and cross-references verified
- [ ] JSDoc documentation complete in source files

## Technical Details

### Documentation Files to Create/Update

1. **Architecture Documentation**
   - Create: `docs/anatomy/body-descriptor-registry.md` (NEW - central registry documentation)
   - Update: `docs/anatomy/architecture.md` (EXISTS - update with registry architecture)

2. **Developer Guides**
   - Create: `docs/anatomy/adding-body-descriptors.md` (NEW - step-by-step guide)
   - Update: `docs/development/anatomy-development-guide.md` (EXISTS - update development workflow)
   - Update: `docs/development/body-descriptors-technical.md` (EXISTS - enhance registry coverage)

3. **Technical Reference**
   - Create: `docs/anatomy/body-descriptor-validator-reference.md` (NEW - validator API reference)

4. **Project Documentation**
   - Update: `README.md` (add validation tool)
   - Update: `CLAUDE.md` (architecture section)

5. **Migration Documentation**
   - Update: `docs/migration/body-descriptor-migration.md` (EXISTS - enhance with registry-specific guidance)

### Content Structure

#### Body Descriptor Registry Documentation

```markdown
# Body Descriptor Registry

## Overview

The Body Descriptor Registry is the centralized source of truth for all body descriptor metadata in the Living Narrative Engine.

## Architecture

### Registry Structure

Each descriptor in the registry contains:
- `schemaProperty`: Name in JSON schema
- `displayLabel`: Human-readable label
- `displayKey`: Key in formatting configuration
- `dataPath`: Path in body component
- `validValues`: Array of valid values (or null)
- `displayOrder`: Display priority
- `extractor`: Function to extract value
- `formatter`: Function to format value
- `required`: Whether descriptor is required

### Location

- **Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`
- **Validator**: `src/anatomy/validators/bodyDescriptorValidator.js`
- **Validation Script**: `scripts/validate-body-descriptors.js`
- **JSON Schema**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)
- **Formatting Config**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Tests**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

## Usage

### Accessing Registry

```javascript
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
} from './registries/bodyDescriptorRegistry.js';

// Get specific descriptor
const heightMetadata = getDescriptorMetadata('height');

// Get all descriptor names
const allDescriptors = getAllDescriptorNames();
```

### Adding a New Descriptor

1. Add entry to `BODY_DESCRIPTOR_REGISTRY`
2. Define all required properties
3. Implement extractor function
4. Implement formatter function
5. Run validation tool
6. Update tests

Example:
```javascript
newDescriptor: {
  schemaProperty: 'newDescriptor',
  displayLabel: 'New Descriptor',
  displayKey: 'new_descriptor',
  dataPath: 'body.descriptors.newDescriptor',
  validValues: ['value1', 'value2'],
  displayOrder: 70,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.newDescriptor,
  formatter: (value) => `New: ${value}`,
  required: false,
}
```

## Validation

### Bootstrap Validation

System automatically validates configuration on startup.

### Manual Validation

Run validation tool:
```bash
npm run validate:body-descriptors
```

### CI/CD Integration

Add to CI pipeline:
```yaml
- name: Validate Body Descriptors
  run: npm run validate:body-descriptors
```

## Best Practices

1. Always add new descriptors to registry first
2. Run validation after changes
3. Test with real recipes
4. Update formatting configuration
5. Document descriptor purpose
6. Follow naming conventions

## Troubleshooting

### Descriptor Not Appearing

If descriptor doesn't appear in descriptions:
1. Check registry definition
2. Verify formatting config includes displayKey
3. Check extractor function
4. Run validation tool

### Validation Errors

Common issues:
- Missing from formatting config
- Invalid values in recipe
- Incorrect extractor function
- Missing required fields

## See Also

- [Body Descriptor Validator Reference](./body-descriptor-validator-reference.md)
- [Adding Body Descriptors Guide](./adding-body-descriptors.md)
- [Anatomy System Architecture](./architecture.md)
- [Body Descriptors Technical Guide](../development/body-descriptors-technical.md)
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md)
```

#### Developer Guide: Adding Body Descriptors

Location: `docs/anatomy/adding-body-descriptors.md` (NEW)

```markdown
# Guide: Adding Body Descriptors

This guide walks through adding a new body descriptor to the system.

## Prerequisites

- Understanding of body descriptor registry
- Familiarity with anatomy system
- Knowledge of JSON schema

## Step-by-Step Process

### 1. Add to Registry (REQUIRED)

File: `src/anatomy/registries/bodyDescriptorRegistry.js`

Add new entry to `BODY_DESCRIPTOR_REGISTRY`:

```javascript
yourDescriptor: {
  schemaProperty: 'yourDescriptor',
  displayLabel: 'Your Descriptor',
  displayKey: 'your_descriptor',
  dataPath: 'body.descriptors.yourDescriptor',
  validValues: ['value1', 'value2', 'value3'],
  displayOrder: 70, // Next available: 70 (after smell at 60)
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.yourDescriptor,
  formatter: (value) => `Your Descriptor: ${value}`,
  required: false,
}
```

### 2. Update JSON Schema

File: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)

Add property to `bodyDescriptors` object:

```json
{
  "bodyDescriptors": {
    "properties": {
      "yourDescriptor": {
        "type": "string",
        "enum": ["value1", "value2", "value3"],
        "description": "Description of your descriptor"
      }
    }
  }
}
```

**Note**: The schema property name should match the `schemaProperty` field in the registry.

### 3. Update Formatting Configuration

File: `data/mods/anatomy/anatomy-formatting/default.json`

Add to `descriptionOrder`:

```json
{
  "descriptionOrder": [
    "height",
    "skin_color",
    "build",
    "body_composition",
    "body_hair",
    "smell",
    "your_descriptor"
  ]
}
```

### 4. Validate Changes

Run validation:
```bash
npm run validate:body-descriptors
```

Should show:
```
✅ Validation Passed
```

### 5. Add Tests

File: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

Test new descriptor:

```javascript
describe('yourDescriptor', () => {
  it('should have complete metadata', () => {
    const metadata = getDescriptorMetadata('yourDescriptor');
    expect(metadata).toBeDefined();
    expect(metadata.displayKey).toBe('your_descriptor');
    expect(metadata.validValues).toContain('value1');
  });
});
```

### 6. Test Integration

Create test recipe and verify descriptor appears in descriptions.

## Verification Checklist

- [ ] Registry entry complete with all fields
- [ ] Schema updated with property
- [ ] Formatting config includes displayKey
- [ ] Validation tool passes
- [ ] Unit tests added
- [ ] Integration tests pass
- [ ] Descriptor appears in generated descriptions
- [ ] Documentation updated

## Common Issues

### Descriptor Not Appearing

**Issue**: Descriptor defined but doesn't show in descriptions

**Solution**: Check formatting config includes displayKey

### Validation Fails

**Issue**: Validation tool reports errors

**Solution**: Verify all three files updated (registry, schema, config)

### Invalid Values

**Issue**: Recipe has invalid values

**Solution**: Check validValues array in registry matches schema enum

## Example: Adding "Posture" Descriptor

Complete example of adding a posture descriptor...

[Full example with code snippets]
```

### Implementation Steps

1. **Create New Documentation**
   - Write body descriptor registry documentation (`docs/anatomy/body-descriptor-registry.md`)
   - Write developer guide for adding descriptors (`docs/anatomy/adding-body-descriptors.md`)
   - Write validator API reference (`docs/anatomy/body-descriptor-validator-reference.md`)

2. **Update Existing Documentation**
   - Update README.md with validation tool
   - Update CLAUDE.md with registry architecture
   - Update anatomy architecture documentation (`docs/anatomy/architecture.md`)
   - Update development guide (`docs/development/anatomy-development-guide.md`)
   - Enhance technical guide (`docs/development/body-descriptors-technical.md`)
   - Enhance migration guide (`docs/migration/body-descriptor-migration.md`)

3. **Add Examples**
   - Complete code examples
   - Common use cases
   - Troubleshooting scenarios

4. **Review and Verify**
   - Check all links work
   - Verify code examples are correct
   - Ensure consistency across docs
   - Get peer review

## Files to Create

- `docs/anatomy/body-descriptor-registry.md` (NEW - central registry documentation)
- `docs/anatomy/adding-body-descriptors.md` (NEW - step-by-step developer guide)
- `docs/anatomy/body-descriptor-validator-reference.md` (NEW - validator API reference)

## Files to Update

- `README.md` (EXISTS)
  - Add validation tool section
  - Update architecture overview with registry

- `CLAUDE.md` (EXISTS)
  - Update anatomy system section
  - Add registry pattern to architecture
  - Update development workflow
  - Add validation commands

- `docs/anatomy/architecture.md` (EXISTS)
  - Add registry architecture section
  - Update data flow diagrams
  - Document registry integration points

- `docs/development/anatomy-development-guide.md` (EXISTS)
  - Update development workflow with registry
  - Add registry usage patterns
  - Include validation tool in workflow

- `docs/development/body-descriptors-technical.md` (EXISTS)
  - Enhance with registry implementation details
  - Document registry-based validation
  - Update code examples to use registry

- `docs/migration/body-descriptor-migration.md` (EXISTS)
  - Add registry-specific migration notes
  - Document validation tool usage
  - Include registry-based best practices

## Success Criteria

- [ ] All documentation files created
- [ ] All existing documentation updated
- [ ] Code examples tested and working
- [ ] Links and cross-references verified
- [ ] Documentation reviewed for accuracy
- [ ] Consistent terminology throughout
- [ ] Examples are clear and complete
- [ ] Troubleshooting section comprehensive

## Content Checklist

### Body Descriptor Registry Doc (NEW)
- [ ] Overview and purpose
- [ ] Architecture explanation
- [ ] Registry structure documentation
- [ ] Usage examples
- [ ] API reference (getDescriptorMetadata, getAllDescriptorNames, etc.)
- [ ] Validation documentation
- [ ] Best practices
- [ ] Troubleshooting

### Developer Guide (NEW)
- [ ] Step-by-step process
- [ ] Prerequisites
- [ ] Code examples for all 3 files (registry, schema, config)
- [ ] Verification checklist
- [ ] Common issues and solutions
- [ ] Complete example with displayOrder values

### Validator Reference (NEW)
- [ ] BodyDescriptorValidator API
- [ ] validateRecipeDescriptors() method
- [ ] validateFormattingConfig() method
- [ ] Validation result structure
- [ ] CLI tool usage (`npm run validate:body-descriptors`)
- [ ] Integration with CI/CD

### Existing Doc Enhancements
- [ ] README.md: Add validation tool section
- [ ] CLAUDE.md: Add registry pattern to architecture section
- [ ] `docs/anatomy/architecture.md`: Add registry architecture
- [ ] `docs/development/anatomy-development-guide.md`: Add registry workflow
- [ ] `docs/development/body-descriptors-technical.md`: Add registry implementation
- [ ] `docs/migration/body-descriptor-migration.md`: Add registry usage patterns

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Depends on: BODDESROB-003 (Refactor BodyDescriptionComposer)
- Depends on: BODDESROB-007 (CLI Validation Tool)
- Related to: Spec Section 4.4 "Phase 4: Documentation Updates"

## Review Process

1. **Self-review**
   - Check for typos and grammar
   - Verify all code examples
   - Test all commands

2. **Peer review**
   - Get feedback from team
   - Address comments
   - Update as needed

3. **User testing**
   - Have someone follow guides
   - Identify unclear sections
   - Improve based on feedback

## Notes

- Keep documentation concise but complete
- Use clear, simple language
- Include plenty of examples
- Make troubleshooting sections practical
- Keep docs in sync with code
- Version documentation if needed
- Consider adding diagrams for complex concepts

## Existing Implementation Details

The following components are already implemented and should be accurately documented:

- **Registry Exports**: `BODY_DESCRIPTOR_REGISTRY`, `getDescriptorMetadata()`, `getAllDescriptorNames()`, `getDescriptorsByDisplayOrder()`, `validateDescriptorValue()`
- **Registry Properties**: Each descriptor has 9 properties: schemaProperty, displayLabel, displayKey, dataPath, validValues, displayOrder, extractor, formatter, required
- **Current Descriptors**: height, skinColor, build, composition, hairDensity, smell (6 total)
- **Display Orders**: Currently used: 10, 20, 30, 40, 50, 60 (next available: 70)
- **Validator Class**: `BodyDescriptorValidator` in `src/anatomy/validators/bodyDescriptorValidator.js`
- **Validation Methods**: `validateRecipeDescriptors()`, `validateFormattingConfig()`
- **CLI Tool**: `scripts/validate-body-descriptors.js` with npm script `validate:body-descriptors`
- **Test Coverage**: Comprehensive unit tests at `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`
