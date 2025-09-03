# CONSREC-002: Event Dispatch Service Consolidation

**Priority**: 1 (High Impact)  
**Phase**: Week 2-3  
**Estimated Effort**: 2-3 days  
**Dependencies**: CONSREC-001 (Validation Core Consolidation)

---

## Objective

Complete the consolidation of all event dispatching utilities into a single `EventDispatchService` class. This addresses the high redundancy pattern where 6+ files implement nearly identical event dispatch logic, with evidence of incomplete consolidation already started.

**Success Criteria:**
- Single `EventDispatchService` handles all event dispatch patterns
- Remove 6+ redundant event dispatch utility files
- Maintain all existing dispatch behaviors (sync, async, with logging, with error handling)
- Complete migration away from deprecated dispatch wrappers

---

## Background

### Current State Analysis
The redundancy analysis identified high redundancy in event dispatching with **clear evidence of started consolidation**:

**Files with overlapping event dispatch logic:**
- `safeDispatchErrorUtils.js` - Primary implementation with safeDispatchError
- `staticErrorDispatcher.js` - **Already marks functions as deprecated** (transition wrapper)
- `eventDispatchService.js` - **Newer consolidated service** (intended target)
- `eventDispatchUtils.js` - Dispatch with logging
- `eventDispatchHelper.js` - Dispatch with error handling  
- `safeDispatchEvent.js` - Safe dispatch wrapper
- `systemErrorDispatchUtils.js` - System error specific dispatch
- `errorReportingUtils.js` - Actor-specific error reporting

**Evidence of Incomplete Consolidation:**
- `staticErrorDispatcher.js` contains deprecated function markers
- `EventDispatchService` appears to be the intended consolidation target
- Multiple dispatch patterns suggest parallel development

**Redundant Patterns to Consolidate:**
- `safeDispatchError` - appears in 3+ files with variations
- `dispatchWithLogging` vs `dispatchWithErrorHandling` - nearly identical
- `dispatchValidationError` - multiple implementations
- System error dispatch patterns scattered across utilities

---

## Scope

### Primary Target:
- **`src/utils/EventDispatchService.js`** - Complete and enhance as single dispatch service

### Files to Consolidate:
- `src/utils/safeDispatchErrorUtils.js` - Primary dispatch logic
- `src/utils/eventDispatchUtils.js` - Logging dispatch patterns
- `src/utils/eventDispatchHelper.js` - Error handling dispatch
- `src/utils/safeDispatchEvent.js` - Safe dispatch wrapper
- `src/utils/systemErrorDispatchUtils.js` - System-specific dispatch
- `src/utils/errorReportingUtils.js` - Actor error reporting

### Files to Remove:
- `src/utils/staticErrorDispatcher.js` - **Already deprecated, ready for removal**
- Individual dispatch utility files after migration

---

## Implementation Steps

### Step 1: Analysis and Service Design (0.5 days)
1. **Audit current EventDispatchService.js**
   ```bash
   # Check if EventDispatchService already exists and its current state
   cat src/utils/eventDispatchService.js
   ```

2. **Map all dispatch patterns**
   - Inventory all dispatch functions across target files
   - Identify behavioral differences that need to be preserved
   - Document async vs sync patterns
   - Note logging and error handling variations

3. **Design unified service interface**
   ```javascript
   class EventDispatchService {
     // Core dispatch methods
     dispatchSystemError(eventBus, error, context, logger)
     dispatchValidationError(eventBus, error, context, logger)
     dispatchEntityError(eventBus, entityId, error, context, logger)
     
     // Enhanced dispatch methods
     dispatchWithLogging(eventBus, event, logger)
     dispatchWithErrorHandling(eventBus, event, logger, errorCallback)
     dispatchAsync(eventBus, event, logger)
     
     // Safe dispatch wrappers
     safeDispatchError(eventBus, error, context, logger)
     safeDispatchEvent(eventBus, event, logger)
     
     // System-specific patterns
     dispatchActorError(eventBus, actorId, error, logger)
     dispatchComponentError(eventBus, componentId, error, logger)
   }
   ```

### Step 2: Complete EventDispatchService Implementation (1.5 days)
1. **Enhance or create EventDispatchService.js**
   ```javascript
   /**
    * @file Centralized event dispatch service for all event dispatching needs
    * Consolidates multiple dispatch utilities into single service
    */
   
   import { validation } from './validationCore.js';
   
   export class EventDispatchService {
     constructor() {
       // Service initialization
     }
   
     /**
      * Dispatch system error with comprehensive logging
      * Consolidates logic from safeDispatchErrorUtils.js
      */
     dispatchSystemError(eventBus, error, context, logger) {
       validation.dependency.validateDependency(eventBus, 'IEventBus', logger);
       validation.dependency.assertPresent(error, 'Error is required for dispatch');
       validation.logger.assertValid(logger, 'EventDispatchService.dispatchSystemError');
       
       try {
         const errorEvent = {
           type: 'SYSTEM_ERROR_OCCURRED',
           payload: {
             error: error.message || error,
             context: context || 'Unknown context',
             timestamp: new Date().toISOString(),
             stack: error.stack
           }
         };
         
         logger.error(`System error dispatched: ${context}`, error);
         eventBus.dispatch(errorEvent);
         
         return true;
       } catch (dispatchError) {
         logger.error(`Failed to dispatch system error: ${context}`, dispatchError);
         return false;
       }
     }
   
     /**
      * Dispatch validation error with specific formatting  
      * Consolidates logic from multiple validation dispatch patterns
      */
     dispatchValidationError(eventBus, error, context, logger) {
       // Implementation with validation-specific error formatting
     }
   
     /**
      * Safe dispatch with comprehensive error handling
      * Consolidates safeDispatchEvent.js functionality
      */
     safeDispatchEvent(eventBus, event, logger) {
       // Implementation with try-catch and fallback handling
     }
   
     /**
      * Dispatch with integrated logging
      * Consolidates eventDispatchUtils.js patterns
      */
     dispatchWithLogging(eventBus, event, logger) {
       // Implementation with pre/post dispatch logging
     }
   
     /**
      * Actor-specific error dispatch
      * Consolidates errorReportingUtils.js patterns  
      */
     dispatchActorError(eventBus, actorId, error, logger) {
       // Implementation with actor context enhancement
     }
   
     // Additional methods for all identified patterns...
   }
   
   // Export singleton instance for backward compatibility
   export const eventDispatchService = new EventDispatchService();
   
   // Export individual functions for gradual migration
   export const dispatchSystemError = (eventBus, error, context, logger) =>
     eventDispatchService.dispatchSystemError(eventBus, error, context, logger);
   ```

2. **Implement all dispatch patterns**
   - Preserve exact behavior from source files
   - Maintain error message formats
   - Keep async/sync patterns intact
   - Ensure logging patterns are consistent

3. **Add service registration support**
   ```javascript
   // For dependency injection compatibility
   export const tokens = {
     IEventDispatchService: 'IEventDispatchService'
   };
   ```

### Step 3: Create Migration Wrappers (0.5 days)
1. **Update deprecated files with forwarding functions**
   ```javascript
   // In staticErrorDispatcher.js (already has deprecation markers)
   import { eventDispatchService } from './EventDispatchService.js';
   
   /**
    * @deprecated Use EventDispatchService.dispatchSystemError instead
    * This file will be removed in next major version
    */
   export function dispatchError(eventBus, error, context, logger) {
     console.warn('DEPRECATED: staticErrorDispatcher.dispatchError - Use EventDispatchService.dispatchSystemError');
     return eventDispatchService.dispatchSystemError(eventBus, error, context, logger);
   }
   ```

2. **Add deprecation warnings to other files**
   - Mark all functions with @deprecated JSDoc
   - Add console.warn messages
   - Forward to EventDispatchService methods

### Step 4: Update Imports and Dependencies (0.5 days)
1. **Update utils/index.js**
   ```javascript
   // Export the new service
   export { EventDispatchService, eventDispatchService } from './EventDispatchService.js';
   export * as dispatch from './EventDispatchService.js';
   
   // Keep deprecated exports during transition
   export * from './staticErrorDispatcher.js'; // Will show warnings
   ```

2. **Update dependency injection registrations**
   ```javascript
   // In main service registration
   container.register(tokens.IEventDispatchService, EventDispatchService);
   ```

### Step 5: Comprehensive Testing (1 day)
1. **Create EventDispatchService test suite**
   ```javascript
   // tests/unit/utils/EventDispatchService.test.js
   describe('EventDispatchService', () => {
     let service, mockEventBus, mockLogger;
   
     beforeEach(() => {
       service = new EventDispatchService();
       mockEventBus = { dispatch: jest.fn() };
       mockLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
     });
   
     describe('dispatchSystemError', () => {
       it('should dispatch system error with proper format', () => {
         const error = new Error('Test error');
         const context = 'Test context';
         
         const result = service.dispatchSystemError(mockEventBus, error, context, mockLogger);
         
         expect(result).toBe(true);
         expect(mockEventBus.dispatch).toHaveBeenCalledWith({
           type: 'SYSTEM_ERROR_OCCURRED',
           payload: expect.objectContaining({
             error: 'Test error',
             context: 'Test context',
             timestamp: expect.any(String)
           })
         });
       });
       
       it('should match behavior of old safeDispatchError', () => {
         // Test behavioral parity with existing implementations
       });
     });
   });
   ```

2. **Integration testing**
   - Test service with real EventBus instances
   - Verify error propagation works correctly
   - Test async dispatch patterns

---

## Testing Requirements

### Unit Tests (Required)
1. **Complete EventDispatchService coverage**
   - All dispatch methods: success and failure cases
   - Error handling and logging verification
   - Async dispatch pattern testing
   - Parameter validation testing

2. **Backward compatibility testing**
   - Deprecated functions forward correctly
   - Warning messages appear as expected
   - No behavioral changes from consolidation

3. **Integration with validation system**
   - Service uses CONSREC-001 validation functions correctly
   - Proper dependency validation throughout

### Integration Tests (Required)
1. **Real EventBus integration**
   - Test dispatch service with actual EventBus implementation
   - Verify event handling pipeline works end-to-end
   - Test error recovery scenarios

2. **Cross-module dispatch testing**
   - Test dispatch from various modules using service
   - Verify consistent behavior across different contexts

---

## Risk Mitigation

### Risk: Breaking Changes in Event Handling
**Mitigation Strategy:**
- Preserve exact event payload formats
- Maintain async/sync behavior patterns
- Keep error message formats identical
- Comprehensive integration testing

### Risk: Performance Impact from Service Layer
**Mitigation Strategy:**
- Benchmark dispatch performance before/after
- Use singleton pattern to minimize instantiation overhead
- Keep service methods lightweight
- Profile memory usage patterns

### Risk: Incomplete Migration
**Mitigation Strategy:**
- Track deprecated function usage with warnings
- Create migration checklist for all dispatch calls
- Provide clear documentation for new patterns

---

## Dependencies & Prerequisites

### Prerequisites:
- **CONSREC-001 completed**: Validation consolidation needed for dependency validation
- Access to all event dispatch utility files

### Concurrent Dependencies:
- Can run in parallel with CONSREC-003 (Logger Utilities)
- Should complete before CONSREC-007 (Cleanup Phase)

---

## Acceptance Criteria

### Functional Requirements:
- [ ] Single EventDispatchService handles all dispatch patterns
- [ ] All existing dispatch behaviors preserved exactly
- [ ] Deprecated functions forward to service with warnings
- [ ] Service integrates with dependency injection system

### Quality Requirements:
- [ ] 95%+ test coverage for EventDispatchService
- [ ] All existing dispatch-related tests continue passing
- [ ] Performance impact < 5% regression
- [ ] Zero ESLint violations

### Migration Requirements:
- [ ] All deprecated files show warnings but remain functional
- [ ] Clear migration path documented for each dispatch pattern
- [ ] Service can be used both as class instance and via exported functions

### File State Requirements:
- [ ] EventDispatchService.js: Complete implementation with all dispatch patterns
- [ ] staticErrorDispatcher.js: Ready for removal (already deprecated)
- [ ] Other dispatch files: Deprecated with forwarding functions
- [ ] utils/index.js: Exports new service properly

---

## Evidence of Started Consolidation

The analysis shows **clear evidence that this consolidation was already started**:

1. **`staticErrorDispatcher.js` already contains deprecation markers**
2. **`EventDispatchService` was identified as the intended target**
3. **Transition wrappers exist but consolidation was not completed**

This ticket completes the consolidation work that was already in progress, making it lower-risk than starting from scratch.

---

## Next Steps After Completion

1. **Begin monitoring deprecated function usage**: Track console warnings to identify heavy usage
2. **Plan removal timeline**: Schedule deletion of deprecated dispatch files (2-3 sprints)
3. **Update team documentation**: Document new dispatch service patterns
4. **Start CONSREC-003**: Logger Utilities Cleanup (can run in parallel)

---

## Notes

### Technical Considerations:
- EventDispatchService should be lightweight and fast
- Consider using factory pattern if different dispatch configurations needed
- Keep service stateless to avoid concurrency issues
- Ensure service works with existing dependency injection patterns

### Migration Strategy:
- Gradual migration is supported through forwarding functions
- Teams can adopt new service incrementally
- Existing code continues working during transition period

---

**Created**: 2025-09-03  
**Based on**: Utility Redundancy Analysis Report  
**Ticket Type**: Consolidation/Migration  
**Impact**: High - Affects error handling patterns across entire codebase