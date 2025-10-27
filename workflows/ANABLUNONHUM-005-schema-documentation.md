# ANABLUNONHUM-005: Schema Documentation and Examples

**Phase**: 1 - Schema Extensions
**Priority**: High
**Estimated Effort**: 4-6 hours
**Dependencies**: ANABLUNONHUM-001, ANABLUNONHUM-002, ANABLUNONHUM-003, ANABLUNONHUM-004

## Overview

Create comprehensive documentation for the three new/extended schemas with examples, migration guides, and best practices. Documentation should enable modders to use the new features without deep technical knowledge.

## Deliverables

### 1. Structure Template Documentation
**File**: `docs/anatomy/structure-templates.md`

**Contents**:
- Purpose and benefits
- Basic structure template format
- Limb sets vs appendages
- Orientation schemes (bilateral, radial, indexed, custom)
- Socket pattern template variables
- Complete examples (spider, dragon, octopoid, centaur)
- Common patterns and best practices

### 2. Blueprint V2 Documentation
**File**: `docs/anatomy/blueprints-v2.md`

**Contents**:
- V1 vs V2 comparison
- When to use v2 (non-human creatures)
- schemaVersion property
- structureTemplate references
- additionalSlots usage
- Migration from v1 to v2
- Complete conversion examples

### 3. Recipe Pattern Documentation
**File**: `docs/anatomy/recipe-patterns.md`

**Contents**:
- Pattern matching overview
- matchesGroup syntax and usage
- matchesPattern wildcards
- matchesAll property filters
- Choosing the right pattern type
- Complex pattern examples
- Pattern precedence and conflicts

### 4. Quick Start Guide
**File**: `docs/anatomy/non-human-quickstart.md`

**Contents**:
- Creating first non-human creature
- Step-by-step spider example
- Template → Blueprint → Recipe workflow
- Common pitfalls and solutions
- Testing and validation

## Acceptance Criteria

- [ ] All four documentation files created
- [ ] Each file includes 3+ complete examples
- [ ] Examples tested and verified working
- [ ] Migration guides include before/after comparisons
- [ ] Best practices section in each document
- [ ] Cross-references between documents
- [ ] Diagrams for complex concepts (optional)
- [ ] Code samples syntax-highlighted

## Example Documentation Structure

```markdown
# Structure Templates

## Overview
Body structure templates define the topology of a creature's body...

## Basic Template
```json
{
  "id": "anatomy:structure_minimal",
  "topology": {
    "rootType": "torso"
  }
}
```

## Limb Sets
Define repeated limb structures...

### Example: Spider (8 Legs)
[Full spider template with explanations]

### Example: Dragon (Wings + Legs)
[Full dragon template with explanations]

## Orientation Schemes
Choose how orientations are computed...

## Best Practices
1. Use descriptive type names
2. Keep counts reasonable (< 20)
3. Choose appropriate orientation scheme
4. Document custom arrangements
```

## References

- **Source Document**: `reports/anatomy-blueprint-non-human-architecture.md`
  - All sections for content
  - Examples throughout
