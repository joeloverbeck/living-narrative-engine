# ANASYSIMP-012: Recipe Creation Checklist Documentation

**Phase:** 1 (Quick Wins)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Reduces trial-and-error
**Status:** Not Started

## Context

No step-by-step guide exists for recipe creation, leading to repeated mistakes and missed requirements.

## Solution Overview

Create comprehensive checklist document at `docs/anatomy/recipe-creation-checklist.md` covering:

1. **Before You Start**
   - Choose or create blueprint
   - Identify required structure template
   - List all part types needed
   - Check component availability

2. **Step 1: Create Component Schemas**
   - Create component schema files
   - Define dataSchema with properties
   - Add to appropriate mod folder
   - Validate schema

3. **Step 2: Create Entity Definitions**
   - Create entity definition files
   - Add anatomy:part component
   - Add required descriptor components
   - Validate entities

4. **Step 3: Create or Update Blueprint**
   - Define root entity with sockets
   - Specify structure template
   - Add additionalSlots if needed
   - Verify socket/slot compatibility

5. **Step 4: Create Recipe**
   - Define recipeId and blueprintId
   - Add body descriptors
   - Configure explicit slots
   - Add pattern matchers
   - Add constraints if needed
   - Validate recipe

6. **Step 5: Test**
   - Load in anatomy visualizer
   - Verify graph generates
   - Check anatomy description
   - Validate all parts appear

7. **Common Pitfalls**
   - Forgetting descriptor components
   - Invalid enum values
   - Missing sockets
   - Pattern mismatches

## File Structure

```
docs/anatomy/
└── recipe-creation-checklist.md    # Main checklist
```

## Acceptance Criteria

- [ ] Checklist covers all steps from planning to testing
- [ ] Includes checkbox format for easy tracking
- [ ] Lists common pitfalls with solutions
- [ ] Provides examples for each step
- [ ] References validation tools
- [ ] Links to related documentation

## Dependencies

**Depends On:** ANASYSIMP-001 through ANASYSIMP-009 (references validation tools)

## References

- **Report Section:** Recommendation 3.1
- **Report Pages:** Lines 898-965
