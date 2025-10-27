# ANABLUNONHUM-025: CLI Migration and Validation Tooling

**Phase**: 6 - Validation & Tooling
**Priority**: Medium
**Estimated Effort**: 10-12 hours
**Dependencies**: ANABLUNONHUM-024

## Overview

Create CLI tools for blueprint migration, template generation, and validation to assist modders.

## Tools to Create

### 1. Blueprint Migration Tool
**Script**: `scripts/migrate-blueprint.js`

```bash
npm run migrate:blueprint -- \
  --input data/mods/my_mod/blueprints/old.json \
  --output data/mods/my_mod/blueprints/new.json \
  --template-name structure_custom
```

**Functionality**:
- Analyze v1 blueprint structure
- Suggest appropriate template
- Generate v2 blueprint with additionalSlots
- Preserve all custom configuration
- Validate before/after

### 2. Template Generator (Reverse Engineering)
**Script**: `scripts/generate-template.js`

```bash
npm run generate:template -- \
  --blueprint anatomy:human_male \
  --output data/mods/anatomy/templates/humanoid.template.json
```

**Functionality**:
- Analyze blueprint slot patterns
- Detect limb count patterns
- Infer orientation scheme
- Generate template automatically
- Useful for converting existing blueprints

### 3. Anatomy Validation Tool
**Script**: `scripts/validate-anatomy-structure.js`

```bash
npm run validate:anatomy-structure -- data/mods/my_mod/
```

**Functionality**:
- Validate all templates in directory
- Validate all blueprints (v1 and v2)
- Validate all recipes
- Check cross-references
- Report errors with helpful messages
- Summary report

### 4. Template Preview Tool
**Script**: `scripts/preview-template.js`

```bash
npm run preview:template -- anatomy:structure_arachnid_8leg
```

**Functionality**:
- Load and display template
- Show generated socket list
- Show generated slot list
- Preview naming patterns
- Useful for debugging

## CLI Output Examples

### Migration Success
```
✓ Analyzed blueprint: anatomy:human_male
✓ Detected pattern: bilateral humanoid (2 arms, 2 legs)
✓ Suggested template: anatomy:structure_humanoid_bilateral
✓ Generated v2 blueprint with 3 additionalSlots
✓ Validated new blueprint
✓ Saved to: data/mods/anatomy/blueprints/human_male.blueprint.json

Migration complete! Template reduces definition from 45 lines to 12.
```

### Validation Report
```
Validating: data/mods/creatures/

Templates (3 found):
  ✓ anatomy:structure_spider_8leg
  ✓ anatomy:structure_dragon
  ✗ anatomy:structure_invalid - Error: count must be > 0

Blueprints (5 found):
  ✓ creatures:giant_spider (v2)
  ✓ creatures:red_dragon (v2)
  ✗ creatures:broken - Error: Template 'anatomy:missing' not found

Recipes (4 found):
  ✓ creatures:forest_spider_recipe
  ✗ creatures:invalid_recipe - Error: Slot group 'limbSet:missing' not found

Summary: 7 passed, 3 failed
```

## Acceptance Criteria

- [ ] All four CLI tools implemented
- [ ] Tools follow project CLI conventions
- [ ] Helpful output with progress indicators
- [ ] Error messages actionable
- [ ] --help flags documented
- [ ] npm scripts registered in package.json
- [ ] Integration tests for each tool
- [ ] Documentation in docs/anatomy/

## Package.json Scripts

```json
{
  "scripts": {
    "migrate:blueprint": "node scripts/migrate-blueprint.js",
    "generate:template": "node scripts/generate-template.js",
    "validate:anatomy-structure": "node scripts/validate-anatomy-structure.js",
    "preview:template": "node scripts/preview-template.js"
  }
}
```

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 6, 8
