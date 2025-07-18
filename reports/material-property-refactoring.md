 Material Property Refactoring - Architectural Analysis Report

    Executive Summary

    The material property in clothing:wearable component should be refactored into a new 
    core:material component to improve architectural consistency and maintainability.

    Current Architecture Analysis

    Property Location & Structure

    - Component: data/mods/clothing/components/wearable.component.json:13-16
    - Type: string
    - Description: "Material composition of the clothing item"
    - Required: No (not in required array)
    - Schema validation: Basic string type only

    Usage Analysis

    Entity Definitions (7 clothing items)

    All clothing entities use material property within clothing:wearable component:

    1. white_structured_linen_blazer.entity.json:8 → "material": "linen"
    2. black_calfskin_belt.entity.json:8 → "material": "calfskin"
    3. leather_stiletto_pumps.entity.json:8 → "material": "leather"
    4. graphite_wool_wide_leg_trousers.entity.json:8 → "material": "wool"
    5. black_stretch_silk_bodysuit.entity.json:8 → "material": "stretch-silk"
    6. nude_thong.entity.json:8 → "material": "silk"
    7. underwired_plunge_bra_nude_silk.entity.json:8 → "material": "silk"

    Code References

    - AnatomyVisualizerUI.js:571 → Extracts material from wearable component: material: 
    wearableData.material || 'unknown'
    - AnatomyVisualizerUI.js:597-600 → Displays material in UI details
    - equipmentDescriptionService.js → References descriptors:material (different 
    component)

    Architectural Issues

    1. Design Inconsistency

    - Material is conceptually a universal property, not clothing-specific
    - Other descriptors (color, texture) use separate descriptor components
    - Breaks ECS separation of concerns principle

    2. Limited Reusability

    - Material property tied to clothing domain only
    - Cannot be used for non-clothing items (furniture, tools, etc.)
    - Violates DRY principle across domains

    3. Schema Limitations

    - Basic string validation only
    - No material taxonomy or enumeration
    - Missing material-specific properties (durability, care instructions)

    Refactoring Plan

    Phase 1: Create Core Material Component

    1. Create data/mods/core/components/material.component.json
    2. Define schema with proper material taxonomy
    3. Add validation for material types and properties

    Phase 2: Update Entity Definitions

    1. Modify 7 clothing entities to use core:material component
    2. Remove material property from clothing:wearable in entities
    3. Update component references from nested to separate

    Phase 3: Update Component Schema

    1. Remove material property from wearable.component.json
    2. Update required fields if necessary
    3. Update component documentation

    Phase 4: Update Code References

    1. Modify AnatomyVisualizerUI.js to read from core:material component
    2. Update equipmentDescriptionService.js material handling
    3. Update test files and test data

    Phase 5: Testing & Validation

    1. Run comprehensive test suite
    2. Validate entity loading
    3. Test UI material display
    4. Verify backward compatibility

    Benefits

    - ✅ Architectural Consistency: Aligns with ECS component design
    - ✅ Reusability: Material component usable across all domains  
    - ✅ Maintainability: Centralized material logic and validation
    - ✅ Extensibility: Easy to add material-specific properties
    - ✅ Type Safety: Proper schema validation for materials

    Risk Assessment

    - Low Risk: Well-contained refactoring with clear boundaries
    - Breaking Changes: Limited to clothing entities only  
    - Test Coverage: Existing tests will catch integration issues
    - Rollback: Simple to revert if issues arise

    Implementation Priority: HIGH

    This refactoring improves architectural consistency and sets foundation for future 
    material-based features across domains.