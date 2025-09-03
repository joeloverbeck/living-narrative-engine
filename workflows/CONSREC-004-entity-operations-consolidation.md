# CONSREC-004: Entity Operations Consolidation

**Priority**: 2 (Medium Impact)  
**Phase**: Week 4-5  
**Estimated Effort**: 2 days  
**Dependencies**: CONSREC-001 (Validation Core Consolidation)

---

## Objective

Create a unified `entityOperations.js` module that consolidates entity validation, assertion, and utility functions scattered across 4+ utility files. This addresses moderate redundancy in entity-related operations while removing deprecated patterns like `assertValidActor`.

**Success Criteria:**
- Single `entityOperations.js` handles all entity-related operations
- Consolidate entity validation logic from 4+ files
- Remove deprecated `assertValidActor` pattern
- Provide consistent entity display and manipulation utilities

---

## Background

### Current State Analysis
The redundancy analysis identified moderate redundancy in entity utilities:

**Files with overlapping entity logic:**
- `entityValidationUtils.js` - isValidEntity, isValidEntityManager
- `entityAssertionsUtils.js` - assertValidEntity, assertValidActor (deprecated)
- `entityUtils.js` - getEntityDisplayName with validation
- `entitiesValidationHelpers.js` - Additional entity validation patterns
- `entityComponentUtils.js` - Component-related validations

**Redundant Patterns Identified:**
| Function Pattern | Current Files | Consolidation Target |
|-----------------|---------------|---------------------|
| Entity validation | 4+ files | entityOperations.js |
| Entity assertions | 2+ files | entityOperations.js |
| Actor validation | Deprecated wrapper | Remove entirely |
| Display utilities | Multiple patterns | entityOperations.js |
| Component validation | Scattered | entityOperations.js |

**Deprecated Patterns to Remove:**
- `assertValidActor` - Already marked deprecated, wrapper around entity validation
- Multiple ways to check if object is valid entity
- Inconsistent entity validation approaches

---

## Scope

### Target File:
- **Create `src/utils/entityOperations.js`** - New unified entity operations module

### Files to Consolidate:
- `src/utils/entityValidationUtils.js` - Core entity validation logic
- `src/utils/entityAssertionsUtils.js` - Entity assertion functions
- `src/utils/entityUtils.js` - Entity display and utility functions
- `src/utils/entitiesValidationHelpers.js` - Additional validation patterns
- `src/utils/entityComponentUtils.js` - Component-related entity operations

### Files to Deprecate/Remove:
- Individual entity utility files (after migration)
- Deprecated `assertValidActor` function (complete removal)

---

## Implementation Steps

### Step 1: Analysis and Design (0.5 days)
1. **Audit all entity utility files**
   ```bash
   # Inventory all entity-related utilities
   find src/utils -name "*entity*" -type f | xargs grep -l "function\|export"
   grep -r "assertValidActor" src/ --include="*.js"
   grep -r "isValidEntity" src/utils --include="*.js"
   ```

2. **Design unified entity operations interface**
   ```javascript
   // entityOperations.js - Unified interface design
   export const entityOperations = {
     // Validation (uses validationCore for base validation)
     validation: {
       isValidEntity(entity),
       isValidEntityManager(entityManager),
       validateEntityStructure(entity, requiredFields),
       validateEntityId(entityId)
     },
     
     // Assertions (throw on failure)
     assertions: {
       assertValidEntity(entity, context, logger),
       assertValidEntityManager(entityManager, context, logger),
       assertEntityExists(entity, entityId, context, logger),
       assertEntityHasComponent(entity, componentType, context, logger)
     },
     
     // Display and utilities
     display: {
       getEntityDisplayName(entity, fallback),
       formatEntityInfo(entity),
       getEntitySummary(entity)
     },
     
     // Component operations
     components: {
       hasComponent(entity, componentType),
       validateComponent(entity, componentType, schema),
       getComponentData(entity, componentType)
     },
     
     // Query and search
     query: {
       findEntitiesByComponent(entities, componentType),
       filterValidEntities(entities),
       searchEntitiesByName(entities, searchTerm)
     }
   };
   
   // Flat exports for backward compatibility
   export const isValidEntity = entityOperations.validation.isValidEntity;
   export const assertValidEntity = entityOperations.assertions.assertValidEntity;
   // etc...
   ```

3. **Map deprecated patterns for removal**
   - Document all `assertValidActor` usage for removal
   - Identify inconsistent validation patterns to standardize
   - Plan migration path for each function

### Step 2: Create Unified entityOperations.js (1 day)
1. **Implement core validation functions**
   ```javascript
   /**
    * @file Unified entity operations for all entity-related functionality
    * Consolidates entity validation, assertions, display, and component operations
    */
   
   import { validation } from './validationCore.js';
   import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
   
   /**
    * Validation functions for entities
    */
   export const validation_entity = {
     /**
      * Check if object is a valid entity
      * Consolidates isValidEntity from multiple files
      */
     isValidEntity(entity) {
       if (!entity || typeof entity !== 'object') return false;
       
       // Entity must have required fields
       return typeof entity.id === 'string' && 
              entity.id.length > 0 &&
              entity.components &&
              typeof entity.components === 'object';
     },
     
     /**
      * Check if object is a valid entity manager
      * From entityValidationUtils.js
      */
     isValidEntityManager(entityManager) {
       if (!entityManager || typeof entityManager !== 'object') return false;
       
       const requiredMethods = ['getEntity', 'createEntity', 'removeEntity', 'hasEntity'];
       return requiredMethods.every(method => typeof entityManager[method] === 'function');
     },
     
     /**
      * Validate entity structure with required fields
      */
     validateEntityStructure(entity, requiredFields = ['id', 'components']) {
       if (!this.isValidEntity(entity)) return false;
       
       return requiredFields.every(field => {
         return entity.hasOwnProperty(field) && entity[field] != null;
       });
     },
     
     /**
      * Validate entity ID format
      */
     validateEntityId(entityId) {
       return validation.string.isNonBlankString(entityId) && 
              entityId.includes(':'); // Namespace format: modId:entityId
     }
   };
   
   /**
    * Assertion functions for entities (throw on failure)
    */
   export const assertions = {
     /**
      * Assert entity is valid, throw if not
      * Consolidates assertValidEntity from multiple files
      */
     assertValidEntity(entity, context = 'Entity validation', logger = console) {
       validation.logger.assertValid(logger, 'assertValidEntity');
       
       if (!validation_entity.isValidEntity(entity)) {
         const error = new InvalidArgumentError(
           `Invalid entity provided: ${context}. Entity must have id and components.`
         );
         logger.error(`Entity validation failed: ${context}`, { entity, error });
         throw error;
       }
     },
     
     /**
      * Assert entity manager is valid
      */
     assertValidEntityManager(entityManager, context = 'EntityManager validation', logger = console) {
       validation.logger.assertValid(logger, 'assertValidEntityManager');
       
       if (!validation_entity.isValidEntityManager(entityManager)) {
         const error = new InvalidArgumentError(
           `Invalid entity manager provided: ${context}. Must implement required methods.`
         );
         logger.error(`EntityManager validation failed: ${context}`, error);
         throw error;
       }
     },
     
     /**
      * Assert entity exists (not null/undefined)
      */
     assertEntityExists(entity, entityId, context = 'Entity existence check', logger = console) {
       if (!entity) {
         const error = new InvalidArgumentError(
           `Entity not found: ${entityId} in context: ${context}`
         );
         logger.error(`Entity existence assertion failed: ${context}`, { entityId, error });
         throw error;
       }
     },
     
     /**
      * Assert entity has specific component
      */
     assertEntityHasComponent(entity, componentType, context = 'Component check', logger = console) {
       this.assertValidEntity(entity, context, logger);
       
       if (!components.hasComponent(entity, componentType)) {
         const error = new InvalidArgumentError(
           `Entity ${entity.id} missing required component: ${componentType} in ${context}`
         );
         logger.error(`Component assertion failed: ${context}`, { entityId: entity.id, componentType, error });
         throw error;
       }
     }
   };
   
   /**
    * Display and formatting utilities
    */
   export const display = {
     /**
      * Get entity display name with fallback
      * From entityUtils.js
      */
     getEntityDisplayName(entity, fallback = 'Unknown Entity') {
       if (!validation_entity.isValidEntity(entity)) return fallback;
       
       // Try various display name sources
       const nameComponent = entity.components['core:name'];
       if (nameComponent && nameComponent.displayName) {
         return nameComponent.displayName;
       }
       
       const actorComponent = entity.components['core:actor'];
       if (actorComponent && actorComponent.name) {
         return actorComponent.name;
       }
       
       // Use entity ID as last resort
       return entity.id || fallback;
     },
     
     /**
      * Format entity information for display
      */
     formatEntityInfo(entity) {
       if (!validation_entity.isValidEntity(entity)) {
         return { error: 'Invalid entity' };
       }
       
       return {
         id: entity.id,
         displayName: this.getEntityDisplayName(entity),
         componentCount: Object.keys(entity.components).length,
         components: Object.keys(entity.components)
       };
     },
     
     /**
      * Get entity summary for debugging
      */
     getEntitySummary(entity) {
       const info = this.formatEntityInfo(entity);
       return `Entity[${info.id}]: "${info.displayName}" (${info.componentCount} components)`;
     }
   };
   
   /**
    * Component operations
    */
   export const components = {
     /**
      * Check if entity has specific component
      */
     hasComponent(entity, componentType) {
       if (!validation_entity.isValidEntity(entity)) return false;
       return entity.components.hasOwnProperty(componentType);
     },
     
     /**
      * Validate component against schema
      */
     validateComponent(entity, componentType, schema) {
       if (!this.hasComponent(entity, componentType)) return false;
       // Could integrate with AJV schema validation here
       return true; // Simplified for now
     },
     
     /**
      * Get component data safely
      */
     getComponentData(entity, componentType) {
       if (!this.hasComponent(entity, componentType)) return null;
       return entity.components[componentType];
     }
   };
   
   /**
    * Query and search operations
    */
   export const query = {
     /**
      * Find entities that have specific component
      */
     findEntitiesByComponent(entities, componentType) {
       if (!Array.isArray(entities)) return [];
       return entities.filter(entity => components.hasComponent(entity, componentType));
     },
     
     /**
      * Filter array to only valid entities
      */
     filterValidEntities(entities) {
       if (!Array.isArray(entities)) return [];
       return entities.filter(entity => validation_entity.isValidEntity(entity));
     },
     
     /**
      * Search entities by display name
      */
     searchEntitiesByName(entities, searchTerm) {
       if (!Array.isArray(entities) || !searchTerm) return [];
       
       const lowerSearch = searchTerm.toLowerCase();
       return entities.filter(entity => {
         const displayName = display.getEntityDisplayName(entity).toLowerCase();
         return displayName.includes(lowerSearch);
       });
     }
   };
   
   // Unified export object
   export const entityOperations = {
     validation: validation_entity,
     assertions,
     display,
     components,
     query
   };
   
   // Flat exports for backward compatibility
   export const isValidEntity = validation_entity.isValidEntity;
   export const isValidEntityManager = validation_entity.isValidEntityManager;
   export const assertValidEntity = assertions.assertValidEntity;
   export const assertValidEntityManager = assertions.assertValidEntityManager;
   export const getEntityDisplayName = display.getEntityDisplayName;
   export const hasComponent = components.hasComponent;
   ```

### Step 3: Deprecate Source Files (0.25 days)
1. **Add deprecation warnings to source files**
   ```javascript
   // In entityValidationUtils.js
   import { entityOperations } from './entityOperations.js';
   
   /**
    * @deprecated Use entityOperations.validation.isValidEntity instead
    */
   export function isValidEntity(entity) {
     console.warn('DEPRECATED: isValidEntity from entityValidationUtils.js - Use entityOperations.validation.isValidEntity');
     return entityOperations.validation.isValidEntity(entity);
   }
   ```

2. **Remove assertValidActor completely**
   ```javascript
   // Remove from entityAssertionsUtils.js - no forwarding
   // This function is already marked deprecated and should be removed
   // Update any usage to use assertValidEntity instead
   ```

### Step 4: Update Index and Dependencies (0.25 days)
1. **Update utils/index.js**
   ```javascript
   // Add entity operations export
   export * as entity from './entityOperations.js';
   export { entityOperations } from './entityOperations.js';
   
   // Keep deprecated exports during transition
   export * from './entityValidationUtils.js'; // With warnings
   export * from './entityAssertionsUtils.js'; // With warnings (except assertValidActor)
   ```

2. **Search and update assertValidActor usage**
   ```bash
   # Find all assertValidActor usage for manual update
   grep -r "assertValidActor" src/ --include="*.js" --exclude-dir=node_modules
   ```

### Step 5: Comprehensive Testing (1 day)
1. **Create comprehensive test suite**
   ```javascript
   // tests/unit/utils/entityOperations.test.js
   describe('EntityOperations', () => {
     describe('validation', () => {
       describe('isValidEntity', () => {
         it('should return true for valid entity', () => {
           const validEntity = {
             id: 'core:testEntity',
             components: { 'core:actor': { name: 'Test' } }
           };
           expect(entityOperations.validation.isValidEntity(validEntity)).toBe(true);
         });
         
         it('should return false for invalid entity', () => {
           expect(entityOperations.validation.isValidEntity({})).toBe(false);
           expect(entityOperations.validation.isValidEntity(null)).toBe(false);
         });
         
         it('should match behavior from entityValidationUtils', () => {
           // Test behavioral parity with old implementation
         });
       });
     });
     
     describe('assertions', () => {
       describe('assertValidEntity', () => {
         it('should not throw for valid entity', () => {
           const validEntity = {
             id: 'core:testEntity',
             components: {}
           };
           expect(() => entityOperations.assertions.assertValidEntity(validEntity)).not.toThrow();
         });
         
         it('should throw InvalidArgumentError for invalid entity', () => {
           expect(() => entityOperations.assertions.assertValidEntity(null))
             .toThrow(InvalidArgumentError);
         });
       });
     });
     
     describe('display', () => {
       describe('getEntityDisplayName', () => {
         it('should return name from name component', () => {
           const entity = {
             id: 'core:testEntity',
             components: {
               'core:name': { displayName: 'Test Entity' }
             }
           };
           expect(entityOperations.display.getEntityDisplayName(entity)).toBe('Test Entity');
         });
         
         it('should fall back to entity ID', () => {
           const entity = { id: 'core:testEntity', components: {} };
           expect(entityOperations.display.getEntityDisplayName(entity)).toBe('core:testEntity');
         });
       });
     });
   });
   ```

2. **Integration testing**
   - Test with real entity data structures
   - Verify component operations work with actual components
   - Test entity manager validation with real entity managers

---

## Testing Requirements

### Unit Tests (Required)
1. **Complete entityOperations coverage**
   - All validation, assertion, display, component, and query functions
   - Edge cases and error conditions
   - Backward compatibility with deprecated functions

2. **Behavioral parity testing**
   - Ensure new functions behave identically to old implementations
   - Test all parameter combinations
   - Verify error messages are consistent

3. **Integration testing**
   - Test with real entity data structures from the game
   - Verify component operations work with actual component schemas
   - Test entity manager integration

### Migration Testing
1. **Deprecated function forwarding**
   - Test that deprecated functions still work via forwarding
   - Verify warning messages appear correctly
   - Ensure assertValidActor removal doesn't break code

---

## Risk Mitigation

### Risk: Breaking Entity Validation Patterns
**Mitigation Strategy:**
- Preserve exact validation logic from source files
- Maintain error message formats and error types
- Comprehensive behavioral testing with real entity data

### Risk: assertValidActor Removal Impact
**Mitigation Strategy:**
- Search entire codebase for assertValidActor usage
- Update all usage before removal
- Provide clear migration path (use assertValidEntity instead)

### Risk: Component Operation Changes
**Mitigation Strategy:**
- Test with actual game components and schemas
- Verify component access patterns still work
- Ensure no performance regression in entity operations

---

## Dependencies & Prerequisites

### Prerequisites:
- **CONSREC-001 completed**: Need validation.string and validation.logger functions
- Access to all entity utility files and actual entity data for testing

### Concurrent Dependencies:
- Can run in parallel with CONSREC-003 (Logger Utilities)
- Can run in parallel with CONSREC-002 (Event Dispatch) if CONSREC-001 is complete

---

## Acceptance Criteria

### Functional Requirements:
- [ ] Single entityOperations.js handles all entity-related operations
- [ ] All entity validation, assertion, display, and component functions consolidated
- [ ] assertValidActor completely removed (deprecated pattern eliminated)
- [ ] Backward compatibility maintained for all other functions

### Quality Requirements:
- [ ] 95%+ test coverage for entityOperations.js
- [ ] All existing entity-related tests continue passing
- [ ] Performance impact < 5% regression for entity operations
- [ ] Zero ESLint violations

### Migration Requirements:
- [ ] Deprecated functions forward correctly with warnings
- [ ] assertValidActor usage updated to assertValidEntity
- [ ] Clear documentation of new entity operations structure

### File State Requirements:
- [ ] entityOperations.js: Complete implementation with all entity functions
- [ ] entityValidationUtils.js: Deprecated with forwarding functions
- [ ] entityAssertionsUtils.js: Deprecated with forwarding (assertValidActor removed)
- [ ] entityUtils.js: Deprecated with forwarding functions
- [ ] Other entity utility files: Deprecated with forwarding

---

## Entity Operations Architecture

```
entityOperations.js
├── validation.*     (entity validation functions)
├── assertions.*     (throwing validation functions) 
├── display.*        (formatting and display utilities)
├── components.*     (component-related operations)
├── query.*          (search and filtering operations)
└── Flat exports     (backward compatibility)

Integration:
├── Uses validationCore.js for base validation
├── Uses project error classes for consistent errors
└── Integrates with existing entity/component patterns
```

---

## Next Steps After Completion

1. **Monitor entity operation performance**: Ensure no regression in entity-heavy operations
2. **Update entity-related documentation**: Document new unified entity operations
3. **Plan deprecated file removal**: Schedule removal of deprecated entity utilities
4. **Continue with CONSREC-005**: Utility Index Organization

---

## Notes

### Technical Considerations:
- Keep entity operations fast (they're used frequently in game loops)
- Maintain compatibility with existing component schemas  
- Consider entity lifecycle patterns when designing operations

### Removal Strategy:
- `assertValidActor` is already deprecated and ready for removal
- Other functions should be gradually migrated via deprecation warnings
- Entity operations are critical - ensure thorough testing

---

**Created**: 2025-09-03  
**Based on**: Utility Redundancy Analysis Report  
**Ticket Type**: Consolidation/Modernization  
**Impact**: Medium - Affects entity operations across game engine