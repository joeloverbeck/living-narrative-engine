# TRAITSGEN-007: Integrate CharacterBuilderService with Traits Generation

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Service Integration
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: TRAITSGEN-003 (TraitsGenerator Service)

## Description
Integrate traits generation functionality into the existing CharacterBuilderService. This integration provides the service layer interface that the controller will use to generate traits and manage the generation workflow.

## Requirements

### File Modification
- **File**: `src/characterBuilder/services/characterBuilderService.js`
- **Purpose**: Add traits generation methods to existing service
- **Pattern**: Follow existing service method patterns

### Required Method Additions

#### 1. Primary Generation Method
```javascript
/**
 * Generate traits for a thematic direction with user inputs
 * @param {Object} concept - Character concept object
 * @param {Object} direction - Thematic direction object  
 * @param {Object} userInputs - User-provided core motivation, contradiction, question
 * @param {Array} cliches - Array of cliche objects to avoid
 * @param {Object} options - Generation options and configuration
 * @returns {Promise<Object>} Generated traits data (not stored per policy)
 */
async generateTraitsForDirection(concept, direction, userInputs, cliches, options = {}) {
  // Implementation workflow:
  // 1. Validate inputs match the service's expected signature
  // 2. Coordinate with TraitsGenerator service
  // 3. Return generated traits without persistence (per storage policy)
  // 4. Dispatch appropriate events (generation_started, completed, failed)
}
```

#### 2. Enhanced Direction Filtering
```javascript
/**
 * Get thematic directions that have both clichés AND core motivations
 * Implements dual filtering requirement from specification
 * @returns {Promise<Array>} Array of {direction, concept} objects with full data
 */
async getDirectionsWithClichesAndMotivations() {
  // 1. Load all thematic directions
  // 2. Filter for directions with clichés (existing pattern)
  // 3. Filter for directions with core motivations (new requirement)
  // 4. Return directions meeting both criteria with full concept data
}

/**
 * Check if direction has core motivations (extends existing pattern)
 * Required for the dual filter (clichés + core motivations)
 * @param {string} directionId - Thematic direction ID
 * @returns {Promise<boolean>} True if direction has core motivations
 */
async hasCoreMot­ivationsForDirection(directionId) {
  // Check if direction has core motivations
  // Extends existing hasClichesForDirection pattern
  // Used for dual filtering validation
}
```

### Integration Implementation

#### Service Dependencies
Add TraitsGenerator as dependency:

```javascript
/**
 * @typedef {import('./TraitsGenerator.js').TraitsGenerator} TraitsGenerator
 */

class CharacterBuilderService {
  constructor(dependencies) {
    // Existing dependencies...
    
    // Add TraitsGenerator dependency
    this.#traitsGenerator = dependencies.traitsGenerator;
    validateDependency(this.#traitsGenerator, 'TraitsGenerator');
  }
}
```

#### Method Implementation Details

##### generateTraitsForDirection Implementation
```javascript
async generateTraitsForDirection(concept, direction, userInputs, cliches, options = {}) {
  try {
    // Validate inputs
    assertPresent(concept, 'Character concept is required');
    assertPresent(direction, 'Thematic direction is required');
    assertPresent(userInputs, 'User inputs are required');
    
    // Validate user inputs structure
    const requiredInputs = ['coreMotivation', 'internalContradiction', 'centralQuestion'];
    for (const input of requiredInputs) {
      assertNonBlankString(userInputs[input], `${input} is required`);
    }

    // Dispatch generation started event
    this.#eventBus.dispatch({
      type: 'traits_generation_started',
      payload: {
        conceptId: concept.id,
        directionId: direction.id,
        timestamp: new Date().toISOString()
      }
    });

    // Call TraitsGenerator service
    const traits = await this.#traitsGenerator.generateTraits(
      concept, 
      direction, 
      userInputs, 
      cliches || [], 
      options
    );

    // Dispatch generation completed event
    this.#eventBus.dispatch({
      type: 'traits_generation_completed',
      payload: {
        conceptId: concept.id,
        directionId: direction.id,
        traitsGenerated: traits ? Object.keys(traits).length : 0,
        timestamp: new Date().toISOString()
      }
    });

    // Return traits without persistence (per storage policy)
    return traits;

  } catch (error) {
    // Log error
    this.#logger.error('Failed to generate traits', error);

    // Dispatch generation failed event
    this.#eventBus.dispatch({
      type: 'traits_generation_failed',
      payload: {
        conceptId: concept?.id,
        directionId: direction?.id,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    // Re-throw for controller handling
    throw error;
  }
}
```

##### getDirectionsWithClichesAndMotivations Implementation
```javascript
async getDirectionsWithClichesAndMotivations() {
  try {
    // Get all directions with clichés (existing method)
    const directionsWithCliches = await this.getDirectionsWithCliches();
    
    // Filter for directions that also have core motivations
    const eligibleDirections = [];
    
    for (const directionData of directionsWithCliches) {
      const hasMotivations = await this.hasCoreMot­ivationsForDirection(directionData.direction.id);
      
      if (hasMotivations) {
        eligibleDirections.push(directionData);
      }
    }

    this.#logger.info(`Found ${eligibleDirections.length} directions with both clichés and core motivations`);
    return eligibleDirections;

  } catch (error) {
    this.#logger.error('Failed to get directions with clichés and motivations', error);
    throw error;
  }
}
```

##### hasCoreMot­ivationsForDirection Implementation
```javascript
async hasCoreMot­ivationsForDirection(directionId) {
  try {
    assertNonBlankString(directionId, 'Direction ID is required');

    // Load core motivations for direction
    const coreMotivations = await this.#database.getCoreMotivationsForDirection(directionId);
    
    // Return true if any core motivations exist
    return coreMotivations && coreMotivations.length > 0;

  } catch (error) {
    this.#logger.error(`Failed to check core motivations for direction ${directionId}`, error);
    // Return false on error to be safe (exclude from filtering)
    return false;
  }
}
```

### Storage Policy Compliance

#### Critical Requirements
Per specification, ensure storage policy compliance:

- **No Persistent Storage**: `generateTraitsForDirection` MUST NOT store traits permanently
- **No Auto-Association**: Traits MUST NOT be automatically linked to concepts/directions  
- **Session-Only Data**: Traits exist only during current session for user review
- **User Control**: All data management decisions remain with the user

#### Implementation Impact
```javascript
// ❌ DO NOT IMPLEMENT - Violates storage policy
async storeTraits(traits, conceptId, directionId) {
  // This method should NOT exist
}

// ❌ DO NOT IMPLEMENT - Violates storage policy
async associateTraitsWithDirection(traits, directionId) {
  // This method should NOT exist
}

// ✅ CORRECT - Event dispatching only (analytics, no persistence)
this.#eventBus.dispatch({
  type: 'traits_generation_completed',
  payload: { /* analytics data only */ }
});
```

### Error Handling Integration

#### Error Types
Handle these error scenarios:

1. **Input Validation Errors**
   - Missing required parameters
   - Invalid concept/direction objects
   - Malformed user inputs

2. **Service Integration Errors**
   - TraitsGenerator service failures
   - Database access errors
   - Network/connectivity issues

3. **Business Logic Errors**
   - Direction lacks required associations
   - User input validation failures
   - Generation constraints not met

#### Error Response Pattern
```javascript
try {
  // Service operations
} catch (error) {
  // Log technical details
  this.#logger.error('Operation failed', error);
  
  // Dispatch analytics event
  this.#eventBus.dispatch({
    type: 'operation_failed',
    payload: { error: error.message, context: operationContext }
  });
  
  // Re-throw with user-friendly message if needed
  if (error instanceof ValidationError) {
    throw new CharacterBuilderError('Please check your inputs and try again');
  }
  
  throw error;
}
```

## Dependency Injection Updates

### Container Registration
Update dependency injection container to include TraitsGenerator:

```javascript
// In dependency registration file
import { TraitsGenerator } from '../characterBuilder/services/TraitsGenerator.js';

// Register TraitsGenerator service
container.register('traitsGenerator', TraitsGenerator, {
  dependencies: [
    'logger',
    'llmJsonService', 
    'llmStrategyFactory',
    'llmConfigManager',
    'eventBus'
  ]
});

// Update CharacterBuilderService registration to include traitsGenerator
container.register('characterBuilderService', CharacterBuilderService, {
  dependencies: [
    // Existing dependencies...
    'traitsGenerator'
  ]
});
```

## Testing Requirements

### Unit Tests
Create comprehensive tests for new methods:

```javascript
describe('CharacterBuilderService - Traits Generation', () => {
  describe('generateTraitsForDirection', () => {
    it('should generate traits with valid inputs');
    it('should validate required user inputs');
    it('should dispatch generation events');
    it('should not store traits (storage policy compliance)');
    it('should handle generation failures gracefully');
  });

  describe('getDirectionsWithClichesAndMotivations', () => {
    it('should return directions with both clichés and core motivations');
    it('should exclude directions missing either requirement');
    it('should handle empty results gracefully');
  });

  describe('hasCoreMot­ivationsForDirection', () => {
    it('should return true for directions with core motivations');
    it('should return false for directions without core motivations');
    it('should handle database errors gracefully');
  });
});
```

### Integration Tests
Test service integration:

```javascript
describe('TraitsGenerator Integration', () => {
  it('should integrate with CharacterBuilderService successfully');
  it('should handle end-to-end traits generation workflow');
  it('should comply with storage policy (no persistence)');
  it('should dispatch appropriate events throughout workflow');
});
```

## Acceptance Criteria

### Functional Requirements
- [ ] `generateTraitsForDirection()` successfully generates traits from valid inputs
- [ ] Method validates all required parameters and user inputs
- [ ] `getDirectionsWithClichesAndMotivations()` returns only eligible directions
- [ ] Dual filtering works correctly (clichés AND core motivations)
- [ ] `hasCoreMot­ivationsForDirection()` accurately checks for motivations
- [ ] All methods handle errors gracefully with proper logging

### Storage Policy Compliance
- [ ] Generated traits are NOT stored permanently
- [ ] Traits are NOT automatically associated with concepts/directions
- [ ] Service returns traits directly without persistence operations
- [ ] User maintains full control over trait data usage

### Event Integration
- [ ] Generation events dispatched for started, completed, failed states
- [ ] Event payloads include appropriate metadata for analytics
- [ ] Events do not trigger persistence operations
- [ ] Error events include sufficient context for debugging

### Error Handling Requirements
- [ ] All error scenarios handled with appropriate error types
- [ ] User-friendly error messages provided where appropriate
- [ ] Technical errors logged with sufficient detail
- [ ] Service fails gracefully without breaking application state

### Testing Requirements
- [ ] Unit tests cover all new methods with success and failure scenarios
- [ ] Integration tests validate service coordination with TraitsGenerator
- [ ] Storage policy compliance verified through tests
- [ ] Event dispatching tested for all scenarios
- [ ] Achieve 85%+ test coverage for new functionality

## Files Modified
- **MODIFIED**: `src/characterBuilder/services/characterBuilderService.js`
- **MODIFIED**: Dependency injection container registration
- **NEW**: Additional unit tests for new methods
- **NEW**: Integration tests for traits generation workflow

## Dependencies For Next Tickets
This service integration is required for:
- TRAITSGEN-005 (Controller Implementation) - Controller uses these service methods
- TRAITSGEN-009 (Integration Testing) - End-to-end workflow testing

## Notes
- Follow existing service method patterns exactly
- Pay strict attention to storage policy compliance requirements
- Ensure proper error handling and event dispatching
- Test dual filtering logic thoroughly
- Consider performance implications of filtering operations