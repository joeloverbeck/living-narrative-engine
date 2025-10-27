# ANABLUNONHUM-020: Create Example Structure Templates

**Phase**: 5 - Example Content
**Priority**: High
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-001, ANABLUNONHUM-006

## Overview

Create four complete structure template examples demonstrating different body plans: spider, dragon, octopoid, centaur.

## Deliverables

### 1. Spider Template
**File**: `data/mods/anatomy/templates/structure_arachnid_8leg.template.json`

- 8 legs (radial arrangement)
- 2 pedipalps
- 1 abdomen
- Demonstrates: indexed orientation, multiple appendage types

### 2. Dragon Template
**File**: `data/mods/anatomy/templates/structure_winged_quadruped.template.json`

- 4 legs (quadrupedal)
- 2 wings (dorsal)
- 1 tail, 1 head
- Demonstrates: custom positions, mixed orientations

### 3. Octopoid Template
**File**: `data/mods/anatomy/templates/structure_octopoid.template.json`

- 8 tentacles (radial)
- 1 mantle, 1 head
- Demonstrates: radial symmetry, simple structure

### 4. Centaur Template
**File**: `data/mods/anatomy/templates/structure_centauroid.template.json`

- 4 legs (rear quadruped)
- 2 arms (front humanoid)
- 1 torso, 1 head
- Demonstrates: hybrid body plan

## Validation

- All templates must pass schema validation
- Test with template loader service
- Verify socket generation works
- Document design decisions in comments

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5
