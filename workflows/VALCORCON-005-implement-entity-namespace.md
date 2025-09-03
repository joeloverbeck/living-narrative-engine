# VALCORCON-005: Implement entity Namespace in validationCore.js

**Priority**: 2 (High - Implementation)  
**Phase**: Implementation Phase 2  
**Estimated Effort**: 6 hours  
**Parent Ticket**: CONSREC-001  
**Dependencies**: VALCORCON-003 (design specifications), VALCORCON-004 (dependency namespace)

---

## Objective

Implement the `entity` namespace in `validationCore.js` by consolidating entity validation functions from various sources, creating a unified API for entity validation across the ECS system.

**Success Criteria:**
- Complete entity namespace implementation in validationCore.js
- Unified entity validation API supporting ECS architecture
- Consistent validation rules for entity IDs, structure, and components
- Integration with existing validation patterns

---

## Background

From analysis tickets, the entity namespace needs to consolidate:
- Entity structure validation (from various entity management files)
- Entity ID validation (from idValidation.js and entity-specific sources)
- Component reference validation
- ECS-specific validation requirements

**Current State:**
- Entity validation scattered across multiple files
- Inconsistent validation approaches for entities
- ID validation specific to entity namespace requirements (modId:identifier format)
- Need unified approach supporting ECS architecture

**ECS Context:**
- Entities: Simple string IDs that group components
- Entity IDs: Format `modId:identifier` or special cases `none`, `self`
- Component validation: Ensuring valid component references

---

## Scope

### Primary Target:
- **File**: `src/utils/validationCore.js`
- **Implementation**: Add complete entity namespace

### Functions to Implement:
```javascript
// Target entity namespace:
export const entity = {
  assertValidEntity,     // Comprehensive entity validation
  isValidEntity,         // Non-throwing entity validation check  
  assertValidId          // Entity ID format validation
};
```

### Integration Points:
- ECS entity management system
- Component loading and validation
- Mod loading system (for ID namespacing)

---

## Implementation Steps

### Step 1: Analyze Entity Validation Requirements (90 minutes)

1. **Study current entity usage patterns**
   ```bash
   # Analyze entity validation in codebase:
   # - Entity creation and management
   # - ID format requirements  
   # - Component reference validation
   # - Error patterns in entity operations
   ```

2. **Define entity validation requirements**
   ```javascript
   // Entity structure requirements:
   // - Valid entity ID (string, proper namespace format)
   // - Optional: component references validation
   // - Optional: entity metadata validation
   
   // Entity ID format requirements:
   // - Standard: "modId:identifier" (e.g., "core:player")
   // - Special cases: "none", "self" (no namespace)
   // - Alphanumeric + underscore for modId
   // - Alphanumeric + underscore + hyphen for identifier
   ```

3. **Identify integration requirements**
   - How entities are created and validated in ECS
   - ID validation requirements for mod loading
   - Component reference validation needs

### Step 2: Implement Core Entity Validation (120 minutes)

1. **Implement assertValidEntity function**
   ```javascript
   /**
    * Validates entity structure and properties
    * @param {*} entity - Entity to validate (typically string ID or object)
    * @param {string} context - Context for error messages
    * @param {Object} logger - Logger instance
    * @throws {InvalidArgumentError} When entity is invalid
    */
   assertValidEntity: (entity, context, logger) => {
     // Input validation
     string.assertNonBlank(entity, 'entity', context, logger);
     
     // Entity-specific validation logic:
     // - If string: validate as entity ID
     // - If object: validate structure (if applicable)
     // - Check for required properties
     // - Validate component references (if present)
   }
   ```

2. **Implement isValidEntity function**  
   ```javascript
   /**
    * Non-throwing entity validation check
    * @param {*} entity - Entity to validate
    * @returns {boolean} True if entity is valid
    */
   isValidEntity: (entity) => {
     try {
       // Use assertValidEntity logic but catch exceptions
       // Return boolean instead of throwing
       return true;
     } catch (error) {
       return false;
     }
   }
   ```

3. **Implement assertValidId function**
   ```javascript
   /**
    * Validates entity ID format according to ECS requirements
    * @param {string} id - Entity ID to validate
    * @param {string} context - Context for error messages  
    * @param {Object} logger - Logger instance
    * @throws {InvalidArgumentError} When ID format is invalid
    */
   assertValidId: (id, context, logger) => {
     // Basic validation
     string.assertNonBlank(id, 'entity ID', context, logger);
     
     // Special cases
     if (id === 'none' || id === 'self') {
       return; // Valid special cases
     }
     
     // Standard format validation: "modId:identifier"
     if (!id.includes(':')) {
       throw new InvalidArgumentError(
         `${context}: entity ID must be in format 'modId:identifier' or be 'none'/'self'. Received: ${id}`
       );
     }
     
     const [modId, identifier] = id.split(':');
     
     // Validate modId format (alphanumeric + underscore)
     if (!/^[a-zA-Z0-9_]+$/.test(modId)) {
       throw new InvalidArgumentError(
         `${context}: modId '${modId}' must contain only alphanumeric characters and underscores`
       );
     }
     
     // Validate identifier format (alphanumeric + underscore + hyphen)
     if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
       throw new InvalidArgumentError(
         `${context}: identifier '${identifier}' must contain only alphanumeric characters, underscores, and hyphens`
       );
     }
   }
   ```

### Step 3: Error Handling and Consistency (90 minutes)

1. **Standardize error message formats**
   ```javascript
   // Entity validation error patterns:
   // "${context}: entity ${validationRule}. ${details}"
   // "${context}: entity ID ${validationRule}. ${details}"
   
   // Examples:
   // "EntityManager.create: entity must be valid entity structure. Received: null"
   // "Component loader: entity ID must be in format 'modId:identifier'. Received: 'invalid-format'"
   ```

2. **Integrate with existing error types**
   - Use InvalidArgumentError for validation failures
   - Consistent parameter validation patterns
   - Logger integration following project patterns

3. **Add comprehensive JSDoc documentation**
   ```javascript
   /**
    * Entity validation utilities for ECS system
    * 
    * Supports entity ID format validation:
    * - Standard format: "modId:identifier" (e.g., "core:player")
    * - Special cases: "none", "self"
    * 
    * @namespace entity
    */
   ```

### Step 4: Integration and Testing (60 minutes)

1. **Update main validation export**
   ```javascript
   // Complete validation object with entity namespace
   export const validation = { 
     string, 
     type, 
     logger, 
     dependency,  // From VALCORCON-004
     entity       // NEW
   };
   ```

2. **Create basic validation tests**
   ```javascript
   // Quick validation that functions work correctly
   // More comprehensive testing in VALCORCON-010
   
   // Test entity ID formats:
   validation.entity.assertValidId('core:player', 'test', console);     // Valid
   validation.entity.assertValidId('none', 'test', console);            // Valid  
   validation.entity.assertValidId('self', 'test', console);            // Valid
   // validation.entity.assertValidId('invalid', 'test', console);      // Should throw
   ```

3. **Verify no circular dependencies**
   - Check import resolution
   - Ensure entity namespace doesn't create circular refs
   - Validate integration with existing namespaces

---

## Deliverables

1. **Enhanced validationCore.js**
   - Complete entity namespace implementation  
   - All 3 entity functions implemented
   - Comprehensive JSDoc documentation
   - Integration with main validation object

2. **Entity Validation Specification**
   - Entity ID format validation rules
   - Entity structure validation requirements
   - Error message format standards
   - Usage examples and patterns

3. **Integration Documentation**
   - How entity validation integrates with ECS
   - ID format requirements and special cases
   - Component reference validation approach
   - Migration notes for existing entity code

---

## Acceptance Criteria

### Implementation Completeness:
- [ ] assertValidEntity function implemented with comprehensive validation
- [ ] isValidEntity function implemented with boolean return
- [ ] assertValidId function implemented with proper ID format validation
- [ ] entity namespace properly exported and integrated

### Entity ID Validation:
- [ ] Standard format "modId:identifier" validation working
- [ ] Special cases "none" and "self" handled correctly
- [ ] ModId format validation (alphanumeric + underscore)
- [ ] Identifier format validation (alphanumeric + underscore + hyphen)
- [ ] Proper error messages for invalid formats

### API Consistency:
- [ ] Function signatures consistent with other namespaces
- [ ] Error handling patterns match project standards
- [ ] Logger integration following established patterns
- [ ] JSDoc documentation complete and consistent

### Integration:
- [ ] No circular dependencies introduced
- [ ] Proper integration with main validation object
- [ ] Compatible with ECS entity management patterns
- [ ] Ready for import migration in later tickets

---

## Dependencies & Prerequisites

### Prerequisites:
- VALCORCON-003: Design specifications for entity namespace
- VALCORCON-004: dependency namespace implementation (for patterns)
- Understanding of ECS entity architecture

### Enables:
- VALCORCON-006: Create unified validation interface
- VALCORCON-010: Entity validation test coverage
- VALCORCON-013: Import migration including entity validation

### Blocks:
- Entity management system improvements requiring unified validation
- Mod loading system enhancements with proper ID validation

---

## Risk Considerations

### Risk: ECS Integration Issues
**Mitigation Strategy:**
- Study existing entity management patterns
- Validate against actual ECS usage
- Test integration with entity creation/loading

### Risk: ID Format Requirements Mismatch
**Mitigation Strategy:**
- Analyze existing entity ID patterns in codebase
- Validate format requirements against mod loading system
- Test with real entity IDs from game data

### Risk: Performance Impact on Entity Operations
**Mitigation Strategy:**
- Keep validation logic efficient
- Benchmark entity validation performance
- Optimize for common validation scenarios

---

## ECS Integration Notes

### Entity Architecture Context:
```javascript
// ECS Pattern in codebase:
// Entity (ID) → Components (Data) → Systems (Rules + Operation Handlers)

// Entity ID examples:
"core:player"        // Standard format
"core:npc-merchant"  // Standard with hyphen
"none"               // Special case
"self"               // Special case  
```

### Component Integration:
- Entity validation should support component reference checking
- ID validation must work with mod loading system
- Integration with existing entity management workflows

---

**Created**: 2025-09-03  
**Based on**: CONSREC-001 Step 2.1  
**Ticket Type**: Implementation/Consolidation  
**Next Ticket**: VALCORCON-006