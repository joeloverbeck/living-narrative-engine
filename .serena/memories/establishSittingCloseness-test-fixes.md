# EstablishSittingClosenessHandler Test Suite Fixes

## Summary
Fixed integration test suite for EstablishSittingClosenessHandler that was failing due to multiple discrepancies between test assumptions and production code.

## Key Discrepancies Fixed

### 1. Parameter Naming
- **Test assumed**: `furnitureEntityId`, `actorId`, `storeResultAs`
- **Production expects**: `furniture_id`, `actor_id`, `result_variable` (with underscores)

### 2. Missing Required Parameter
- Production handler requires `spot_index` parameter
- Added `spot_index` to all test handler.execute() calls

### 3. Component Names
- **Test assumed**: `positioning:closeness_circle` with `members` array
- **Production uses**: `positioning:closeness` with `partners` array

### 4. Movement Lock Component
- **Test assumed**: `positioning:movement_lock` with `isLocked` property
- **Production uses**: `core:movement` with `locked` property

### 5. Entity Creation
- **Test passed**: `{ id: 'alice', components: {...} }`
- **Factory expects**: `{ instanceId: 'alice', baseComponents: {...} }`

### 6. EntityManager Methods
- **Test used**: `entityManager.updateComponent()`
- **SimpleEntityManager provides**: `entityManager.addComponent()`
- **Test used**: `entityManager.getComponent()`
- **SimpleEntityManager provides**: `entityManager.getComponentData()`

### 7. Result Storage
- Test expected complex result object
- Production handler returns void (undefined) and stores boolean in context

### 8. Event Dispatching
- Test expected custom event type 'ESTABLISH_SITTING_CLOSENESS_FAILED'
- Production dispatches 'core:system_error_occurred' via safeDispatchError utility
- Updated mock safeEventDispatcher to properly handle two-argument dispatch calls

## Test Status
All 6 tests now pass successfully after fixing these discrepancies.