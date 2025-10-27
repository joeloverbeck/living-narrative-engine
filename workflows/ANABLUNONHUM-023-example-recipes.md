# ANABLUNONHUM-023: Create Example Recipes Demonstrating Pattern Features

**Phase**: 5 - Example Content
**Priority**: Medium
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-022

## Overview

Create 2+ recipes per blueprint demonstrating new pattern matching features.

## Deliverables

### Spider Recipes (2)

**1. Giant Forest Spider**
- Uses `matchesGroup: "limbSet:leg"` for all 8 legs
- Uses `matchesGroup: "appendage:pedipalp"` for pedipalps
- Properties: hairy, chitinous texture

**2. Venomous Cave Spider**
- Uses wildcard pattern `leg_*`
- Different venom gland configuration
- Properties: smooth, venomous

### Dragon Recipes (2)

**1. Red Dragon**
- Uses `matchesPattern: "front_*_leg"`
- Uses `matchesPattern: "rear_*_leg"`
- Uses `matchesGroup: "limbSet:wing"`
- Fire breathing configuration

**2. Ice Dragon**
- Property-based filters: `matchesAll: {slotType: "leg", orientation: "front_*"}`
- Ice breath configuration

### Octopoid Recipe (1)

**Kraken**
- Uses `matchesGroup: "limbSet:tentacle"` for all 8
- Properties: prehensile, suckered
- Constraints: chromatophore required

### Centaur Recipe (1)

**Centaur Warrior**
- Mixed patterns for different limb types
- Humanoid upper body parts
- Equine lower body parts

## Pattern Demonstrations

Each recipe must showcase:
- At least one new pattern type
- Property-based part selection
- Constraints (co-presence/exclusion)

## Validation

- All recipes validate against extended schema
- Successfully process with RecipeProcessor
- Integration tests confirm correct part assignment

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5
