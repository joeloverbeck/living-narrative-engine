# ACTDESC-004: Set Up Dependency Injection Registration

## Status
🟡 **Pending**

## Phase
**Phase 1: Foundation** (Week 1)

## Description
Register `ActivityDescriptionService` in the dependency injection container and update `BodyDescriptionComposer` registration to inject the new service as an optional dependency.

## Background
Following the LNE pattern, all services must be registered in the DI container. The ActivityDescriptionService follows the Equipment service pattern as an optional dependency to maintain backward compatibility.

**Reference**: Design document lines 1757-1787 (DI Container Registration)

## Objectives
- Register ActivityDescriptionService in DI container
- Update BodyDescriptionComposer registration with new dependency
- Ensure proper dependency resolution
- Maintain backward compatibility (service is optional)

## Technical Specification

### File to Modify
`src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

### Registration Code
```javascript
// Register ActivityDescriptionService
container.register(
  'ActivityDescriptionService',
  ActivityDescriptionService,
  {
    logger: tokens.ILogger,
    entityManager: tokens.IEntityManager,
    anatomyFormattingService: 'AnatomyFormattingService',
    // activityIndex will be added in Phase 3 (ACTDESC-020)
  }
);

// Update BodyDescriptionComposer registration
container.register(
  'BodyDescriptionComposer',
  BodyDescriptionComposer,
  {
    bodyPartDescriptionBuilder: 'BodyPartDescriptionBuilder',
    bodyGraphService: 'BodyGraphService',
    entityFinder: tokens.IEntityFinder,
    anatomyFormattingService: 'AnatomyFormattingService',
    partDescriptionGenerator: 'PartDescriptionGenerator',
    equipmentDescriptionService: 'EquipmentDescriptionService',
    activityDescriptionService: 'ActivityDescriptionService', // ← ADD THIS
    logger: tokens.ILogger,
  }
);
```

### Import Statement
```javascript
import ActivityDescriptionService from '../../anatomy/services/activityDescriptionService.js';
```

## Acceptance Criteria
- [ ] ActivityDescriptionService registered in DI container
- [ ] All required dependencies specified
- [ ] BodyDescriptionComposer registration updated
- [ ] Service resolves successfully from container
- [ ] No circular dependency issues
- [ ] Backward compatibility maintained (service optional in composer)
- [ ] Container boots without errors

## Dependencies
- **Requires**: ACTDESC-005 (ActivityDescriptionService class created)
- **Requires**: ACTDESC-010 (BodyDescriptionComposer integration)

## Testing Requirements
- Integration test verifies service can be resolved from container
- Test that BodyDescriptionComposer receives the service
- Test that BodyDescriptionComposer works without the service (backward compat)
- Verify no dependency resolution errors
- Test container boot sequence completes successfully

## Implementation Notes
1. **Import Location**: ActivityDescriptionService will be at `src/anatomy/services/activityDescriptionService.js`

2. **Dependency Token Pattern**:
   - Use `tokens.ILogger` for logger (interface token)
   - Use `tokens.IEntityManager` for entity manager (interface token)
   - Use string `'AnatomyFormattingService'` for concrete service

3. **Optional Dependency Pattern**:
   - BodyDescriptionComposer constructor should default to `null`:
     ```javascript
     constructor({
       // ... other deps
       activityDescriptionService = null,
       logger = null,
     }) {
       this.activityDescriptionService = activityDescriptionService;
     }
     ```

4. **Phase 3 Note**: In ACTDESC-020, will add `activityIndex` dependency:
   ```javascript
   {
     // ... existing deps
     activityIndex: 'ActivityComponentIndex', // Phase 3
   }
   ```

## Validation Steps
```javascript
// Manual validation after implementation
const container = createContainer();
const service = container.resolve('ActivityDescriptionService');
const composer = container.resolve('BodyDescriptionComposer');

console.assert(service !== null, 'Service should resolve');
console.assert(composer.activityDescriptionService === service, 'Composer should receive service');
```

## Reference Files
- Registration file: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`
- Service file: `src/anatomy/services/activityDescriptionService.js` (ACTDESC-005)
- Composer file: `src/anatomy/bodyDescriptionComposer.js` (ACTDESC-010)
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1757-1787)

## Success Metrics
- Container resolves service without errors
- All dependencies properly injected
- Service is functional when retrieved from container
- No breaking changes to existing code

## Related Tickets
- **Requires**: ACTDESC-005 (Service class must exist)
- **Requires**: ACTDESC-010 (Composer integration must be ready)
- **Blocks**: ACTDESC-012 (Unit tests need DI setup)
- **Future**: ACTDESC-020 (Will add activityIndex dependency)
