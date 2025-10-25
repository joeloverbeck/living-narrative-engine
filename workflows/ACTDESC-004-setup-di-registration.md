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

## Prerequisites
⚠️ **CRITICAL**: This ticket MUST be completed AFTER:
1. **ACTDESC-005** (ActivityDescriptionService class creation)
   - The service file must exist at `src/anatomy/services/activityDescriptionService.js`
   - Cannot register a non-existent service in DI container
2. **ACTDESC-010** (BodyDescriptionComposer integration)
   - Constructor must be updated to accept `activityDescriptionService` parameter
   - Current constructor does NOT have this parameter yet

**Implementation Order**: ACTDESC-005 → ACTDESC-010 → **ACTDESC-004** (this ticket)

## Objectives
- Register ActivityDescriptionService in DI container
- Update BodyDescriptionComposer registration with new dependency
- Ensure proper dependency resolution
- Maintain backward compatibility (service is optional)

## Technical Specification

### Files to Modify
1. `src/dependencyInjection/tokens/tokens-core.js` (add token)
2. `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (registration)

### Step 1: Token Registration
**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add the service token to the tokens object:
```javascript
export const tokens = {
  // ... existing tokens
  ActivityDescriptionService: 'ActivityDescriptionService',
  // ... rest of tokens
};
```

**Note**: This token must be added BEFORE the service can be registered in the DI container.

### Step 2: Service Registration
**File**: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

**Add Import** (at top of file):
```javascript
import ActivityDescriptionService from '../../anatomy/services/activityDescriptionService.js';
```

**Registration Code** (using singletonFactory pattern):
```javascript
// Register ActivityDescriptionService
registrar.singletonFactory(
  tokens.ActivityDescriptionService,
  (c) => new ActivityDescriptionService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    // activityIndex will be added in Phase 3 (ACTDESC-020)
  })
);

// Update BodyDescriptionComposer registration
registrar.singletonFactory(
  'BodyDescriptionComposer',
  (c) => new BodyDescriptionComposer({
    bodyPartDescriptionBuilder: c.resolve('BodyPartDescriptionBuilder'),
    bodyGraphService: c.resolve('BodyGraphService'),
    entityFinder: c.resolve(tokens.IEntityFinder),
    anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    partDescriptionGenerator: c.resolve('PartDescriptionGenerator'),
    equipmentDescriptionService: c.resolve('EquipmentDescriptionService'),
    activityDescriptionService: c.resolve(tokens.ActivityDescriptionService), // ← ADD THIS
    logger: c.resolve(tokens.ILogger),
  })
);
```

**Pattern Notes**:
- Uses `registrar.singletonFactory()` (actual codebase pattern)
- Uses `c.resolve()` for dependency resolution inside factory
- Uses `tokens.ActivityDescriptionService` (not string) for the service token
- Uses `tokens.AnatomyFormattingService` (not string) for formatting service

## Acceptance Criteria
- [ ] Token added to tokens-core.js
- [ ] ActivityDescriptionService registered in DI container using singletonFactory
- [ ] All required dependencies specified and resolved correctly
- [ ] BodyDescriptionComposer registration updated with activityDescriptionService
- [ ] Service resolves successfully from container
- [ ] No circular dependency issues
- [ ] Backward compatibility maintained (service optional in composer)
- [ ] Container boots without errors
- [ ] Import statement added to worldAndEntityRegistrations.js

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

### 1. Token Registration
- **Location**: `src/dependencyInjection/tokens/tokens-core.js`
- **Pattern**: Add `ActivityDescriptionService: 'ActivityDescriptionService'` to tokens object
- **Timing**: Must be done BEFORE service registration

### 2. Import Location
- ActivityDescriptionService will be at `src/anatomy/services/activityDescriptionService.js`
- Import path: `../../anatomy/services/activityDescriptionService.js` (relative to worldAndEntityRegistrations.js)

### 3. Dependency Token Pattern (CORRECTED)
- Use `tokens.ILogger` for logger (interface token)
- Use `tokens.IEntityManager` for entity manager (interface token)
- Use `tokens.AnatomyFormattingService` for formatting service (**token, not string**)
- Use `tokens.ActivityDescriptionService` for activity service (**token, not string**)
- Use `c.resolve()` inside factory function for all dependencies

### 4. Registration Pattern
- Use `registrar.singletonFactory()` method (not `container.register()`)
- First parameter: token reference (e.g., `tokens.ActivityDescriptionService`)
- Second parameter: factory function `(c) => new ServiceClass({ ... })`
- All dependencies resolved via `c.resolve(token)` inside factory

### 5. Optional Dependency Pattern
- BodyDescriptionComposer constructor must be updated in ACTDESC-010 first
- Constructor should default to `null`:
  ```javascript
  constructor({
    // ... other deps
    activityDescriptionService = null,
    logger = null,
  }) {
    this.activityDescriptionService = activityDescriptionService;
  }
  ```
- **Current State**: Constructor does NOT have this parameter yet

### 6. Phase 3 Future Enhancement
In ACTDESC-020, will add `activityIndex` dependency:
```javascript
registrar.singletonFactory(
  tokens.ActivityDescriptionService,
  (c) => new ActivityDescriptionService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    activityIndex: c.resolve('ActivityComponentIndex'), // Phase 3 addition
  })
);
```

## Validation Steps
```javascript
// Manual validation after implementation
const container = createContainer();
const service = container.resolve(tokens.ActivityDescriptionService);
const composer = container.resolve('BodyDescriptionComposer');

console.assert(service !== null, 'Service should resolve');
console.assert(composer.activityDescriptionService === service, 'Composer should receive service');
```

**Note**: Use `tokens.ActivityDescriptionService` (not string) when resolving the service.

## Reference Files
- **Token file**: `src/dependencyInjection/tokens/tokens-core.js` (add token here first)
- **Registration file**: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`
- **Service file**: `src/anatomy/services/activityDescriptionService.js` (created in ACTDESC-005)
- **Composer file**: `src/anatomy/bodyDescriptionComposer.js` (updated in ACTDESC-010)
- **Design document**: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1757-1787)
- **Existing pattern reference**: See EquipmentDescriptionService registration in worldAndEntityRegistrations.js (lines 689-697)

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
