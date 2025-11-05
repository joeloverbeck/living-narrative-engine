# BODDESROB-008: Update Documentation for Body Descriptor Registry

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 4 (Documentation)
**Estimated Effort**: 1 day
**Dependencies**: BODDESROB-001, BODDESROB-002, BODDESROB-003, BODDESROB-007

## Overview

Update all project documentation to reflect the new body descriptor registry architecture. This includes technical documentation, developer guides, architecture docs, and user-facing documentation.

## Problem Context

After implementing the registry system, documentation needs to be updated to:
- Explain the new architecture
- Guide developers on adding new descriptors
- Document validation tools and processes
- Update CLAUDE.md with architectural changes
- Provide examples and best practices

Outdated documentation leads to confusion and incorrect usage patterns.

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
   - Create: `docs/anatomy/body-descriptor-registry.md`
   - Update: `docs/architecture/anatomy-system.md`

2. **Developer Guides**
   - Create: `docs/guides/adding-body-descriptors.md`
   - Update: `docs/development/anatomy-development.md`

3. **Technical Reference**
   - Create: `docs/reference/body-descriptor-validator.md`
   - Update: `docs/reference/anatomy-api.md`

4. **Project Documentation**
   - Update: `README.md` (add validation tool)
   - Update: `CLAUDE.md` (architecture section)

5. **Migration Documentation**
   - Create: `docs/migration/body-descriptor-registry-migration.md`

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

Registry: `src/anatomy/registries/bodyDescriptorRegistry.js`

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

- [Body Descriptor Validator](./body-descriptor-validator.md)
- [Adding Body Descriptors Guide](../guides/adding-body-descriptors.md)
- [Anatomy System Architecture](../architecture/anatomy-system.md)
```

#### Developer Guide: Adding Body Descriptors

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
  displayOrder: 80, // Choose next available number
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.yourDescriptor,
  formatter: (value) => `Your Descriptor: ${value}`,
  required: false,
}
```

### 2. Update JSON Schema

File: `data/schemas/anatomy.recipe.schema.json`

Add property to `bodyDescriptors`:

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
   - Write body descriptor registry documentation
   - Write developer guide for adding descriptors
   - Write technical reference for validator
   - Write migration guide

2. **Update Existing Documentation**
   - Update README.md with validation tool
   - Update CLAUDE.md with registry architecture
   - Update anatomy system documentation
   - Update API reference

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

- `docs/anatomy/body-descriptor-registry.md` (NEW)
- `docs/guides/adding-body-descriptors.md` (NEW)
- `docs/reference/body-descriptor-validator.md` (NEW)
- `docs/migration/body-descriptor-registry-migration.md` (NEW)

## Files to Update

- `README.md` (MODIFY)
  - Add validation tool section
  - Update architecture overview

- `CLAUDE.md` (MODIFY)
  - Update anatomy system section
  - Add registry pattern to architecture
  - Update development workflow

- `docs/architecture/anatomy-system.md` (MODIFY if exists)
  - Add registry architecture
  - Update data flow diagrams

- `docs/development/anatomy-development.md` (MODIFY if exists)
  - Update development workflow
  - Add registry usage patterns

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

### Body Descriptor Registry Doc
- [ ] Overview and purpose
- [ ] Architecture explanation
- [ ] Registry structure documentation
- [ ] Usage examples
- [ ] API reference
- [ ] Validation documentation
- [ ] Best practices
- [ ] Troubleshooting

### Developer Guide
- [ ] Step-by-step process
- [ ] Prerequisites
- [ ] Code examples
- [ ] Verification checklist
- [ ] Common issues and solutions
- [ ] Complete example

### README.md Updates
- [ ] Add validation tool section
- [ ] Update quick start if needed
- [ ] Add registry overview
- [ ] Update architecture section

### CLAUDE.md Updates
- [ ] Update anatomy system section
- [ ] Add registry pattern
- [ ] Update file structure
- [ ] Update development workflow
- [ ] Add validation commands

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
