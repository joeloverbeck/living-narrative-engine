# INJREPANDUSEINT-011 Ticket Analysis Report

**Date**: 2025-12-02  
**Status**: EXPLORATION COMPLETE  
**Context**: Verifying assumptions for integrating injury data into ActorDataExtractor

---

## Executive Summary

The exploration confirms that **ActorDataExtractor is ready to accept injury-related dependencies**, and both **InjuryAggregationService and InjuryNarrativeFormatterService already exist** with well-defined DTOs. However, **ActorPromptDataDTO does NOT yet include health-related properties** - these need to be added as part of the ticket implementation.

---

## 1. ActorDataExtractor Current State

### Location
`src/turns/services/actorDataExtractor.js`

### Class Structure
```javascript
class ActorDataExtractor extends IActorDataExtractor {
  constructor({ anatomyDescriptionService, entityFinder })
  extractPromptData(actorState, actorId = null) -> ActorPromptDataDTO
}
```

### Current Dependencies (2)
1. **anatomyDescriptionService**: Used to fetch anatomy-based descriptions when available
2. **entityFinder**: Used to retrieve entity instances for component access

**Key Finding**: The constructor uses simple property assignment (not Object.defineProperty or dependency validation). The service currently does NOT validate dependencies at construction time.

### Current extractPromptData() Signature
```javascript
/**
 * @param {object} actorState - The gameState.actorState object (map of component IDs to data)
 * @param {string} [actorId] - Optional actor entity ID for anatomy lookups
 * @returns {ActorPromptDataDTO} The populated DTO
 */
extractPromptData(actorState, actorId = null)
```

**Return Type**: `ActorPromptDataDTO` - A JSDoc typedef defined in `AIGameStateDTO.js`

### Implementation Notes
- The method validates that `actorState` is an object, throwing `TypeError` if not
- Uses helper function `getTrimmedComponentText()` to safely extract and trim text from components
- Falls back to default values (`DEFAULT_FALLBACK_CHARACTER_NAME`, `DEFAULT_FALLBACK_DESCRIPTION_RAW`) when components are missing
- Ensures terminal punctuation on descriptions using `ensureTerminalPunctuation()`
- Already uses the `actorId` parameter for anatomy lookups, demonstrating the pattern for optional entity-specific data

---

## 2. AIGameStateDTO Typedefs

### File Location
`src/turns/dtos/AIGameStateDTO.js`

### Current Typedefs (8 total)
1. **ActorPromptDataDTO** ✓ (RELEVANT)
2. **AIActorStateDTO**
3. **AIAvailableActionDTO**
4. **AICharacterInLocationDTO**
5. **AIGameStateDTO**
6. **AILocationExitDTO**
7. **AILocationSummaryDTO**
8. **AIPerceptionLogEntryDTO**

### ActorPromptDataDTO Current Definition (lines 102-123)

**Current Properties** (21 total):
```javascript
@typedef {object} ActorPromptDataDTO
 * @property {string} id - The entity ID of the actor
 * @property {string} name - The name of the actor
 * @property {string} [apparentAge] - How old the character appears to be
 * @property {string} [description] - Physical appearance and visual characteristics
 * @property {string} [personality] - Character traits and temperament
 * @property {string} [profile] - Background story and history
 * @property {string} [likes] - Things the character enjoys
 * @property {string} [dislikes] - Things the character avoids or dislikes
 * @property {string} [strengths] - Character's capabilities and advantages
 * @property {string} [weaknesses] - Character's limitations and vulnerabilities
 * @property {string} [secrets] - Hidden information about the character
 * @property {string} [fears] - What the character is afraid of
 * @property {Array<string>} [speechPatterns] - Examples of how the character speaks
 * @property {string} [motivations] - Core psychological motivations driving behavior
 * @property {string} [internalTensions] - Internal conflicts and competing desires
 * @property {string} [coreDilemmas] - Fundamental questions the character grapples with
 * @property {Array<object>} [goals] - Character's objectives with timestamps
 * @property {Array<object>} [memories] - Character's memory entries
 * @property {Array<object>} [relationships] - Character's relationships with other entities
 * @property {object} [notes] - Character's notes and observations
```

**CRITICAL FINDING**: NO health-related properties exist in ActorPromptDataDTO. The following do NOT exist and need to be added:
- ActorHealthStateDTO
- ActorInjuryDTO
- Any health/injury related properties

---

## 3. Dependency Services Status

### 3.1 InjuryAggregationService ✓ EXISTS

**File Location**: `src/anatomy/services/injuryAggregationService.js`

**Status**: Fully implemented and registered

**Key Typedefs** (from service):
```javascript
@typedef {object} InjuredPartInfo
 * @property {string} partEntityId - Entity ID of the injured part
 * @property {string} partType - Type of part (arm, leg, torso, head, etc.)
 * @property {string|null} orientation - left, right, or null
 * @property {string} state - Current health state (bruised, wounded, badly_damaged, destroyed)
 * @property {number} healthPercentage - 0-100
 * @property {number} currentHealth - Current health points
 * @property {number} maxHealth - Maximum health points
 * @property {boolean} isBleeding - Has anatomy:bleeding component
 * @property {string|null} bleedingSeverity - minor, moderate, severe, or null
 * @property {boolean} isBurning - Has anatomy:burning component
 * @property {boolean} isPoisoned - Has anatomy:poisoned component
 * @property {boolean} isFractured - Has anatomy:fractured component
 * @property {boolean} isStunned - Has anatomy:stunned component

@typedef {object} InjurySummaryDTO
 * @property {string} entityId - Owner entity ID
 * @property {string} entityName - Name of the entity
 * @property {string} entityPronoun - Pronoun (he/she/they/it)
 * @property {InjuredPartInfo[]} injuredParts - All parts not in 'healthy' state
 * @property {InjuredPartInfo[]} bleedingParts - Parts with active bleeding
 * @property {InjuredPartInfo[]} burningParts - Parts with active burning
 * @property {InjuredPartInfo[]} poisonedParts - Parts with poison
 * @property {InjuredPartInfo[]} fracturedParts - Parts with fractures
 * @property {InjuredPartInfo[]} destroyedParts - Parts that are destroyed
 * @property {number} overallHealthPercentage - Weighted average health (0-100)
 * @property {boolean} isDying - Has anatomy:dying component
 * @property {number|null} dyingTurnsRemaining - If dying, turns until death
 * @property {string|null} dyingCause - If dying, what caused it
 * @property {boolean} isDead - Has anatomy:dead component
 * @property {string|null} causeOfDeath - If dead, what killed them
```

**Constructor Signature**:
```javascript
constructor({ logger, entityManager, bodyGraphService })
```

**Main Method**:
```javascript
aggregateInjuries(entityId) -> InjurySummaryDTO
```

**DI Registration** (line 289-292 in aiRegistrations.js):
Already present and well-integrated into the DI container.

### 3.2 InjuryNarrativeFormatterService ✓ EXISTS

**File Location**: `src/anatomy/services/injuryNarrativeFormatterService.js`

**Status**: Fully implemented and registered

**Key Methods**:
```javascript
formatFirstPerson(summary: InjurySummaryDTO) -> string
// Formats injury in first-person sensory voice for status panel display
```

**Constructor Signature**:
```javascript
constructor({ logger })
```

**Note**: This service has minimal dependencies - only logger. It's designed for formatting, not data collection.

---

## 4. Test File Structure

### File Location
`tests/unit/turns/services/actorDataExtractor.test.js`

### Test Coverage
- **Default values tests**: Name and description fallbacks
- **Text extraction tests**: Trimming, punctuation handling
- **Optional attribute tests**: All 7 optional text fields (personality, profile, likes, etc.)
- **Speech patterns tests**: Array handling, filtering empty values
- **Psychological components tests**: motivations, internalTensions, coreDilemmas
- **Apparent age tests**: Range handling (minAge, maxAge, bestGuess)
- **Error handling tests**: TypeError for invalid actorState

### Total Test Cases
**67+ test cases** with comprehensive coverage of:
- Happy path scenarios
- Edge cases (null, empty string, whitespace)
- Type mismatches
- Missing optional fields
- Mix of valid and invalid data

### Test Patterns Used
```javascript
// Pattern 1: Default value tests
test('should return default X when component is missing', () => {
  const actorState = {};
  const result = extractor.extractPromptData(actorState);
  expect(result.X).toBe(DEFAULT_X);
});

// Pattern 2: Extraction + transformation tests
test('should extract, trim, and punctuate description', () => {
  const actorState = { [DESC_ID]: { text: '  Description  ' } };
  const result = extractor.extractPromptData(actorState);
  expect(result.description).toBe('Description.');
});

// Pattern 3: Optional field handling
test('should leave X undefined if component is missing', () => {
  const result = extractor.extractPromptData({});
  expect(result.X).toBeUndefined();
});
```

### Existing Mock Setup
```javascript
mockAnatomyDescriptionService = {
  getOrGenerateBodyDescription: jest.fn(),
};
mockEntityFinder = {
  getEntityInstance: jest.fn(),
};
```

---

## 5. DI Registration Details

### Location
`src/dependencyInjection/registrations/aiRegistrations.js` (lines 288-292)

### Current Registration
```javascript
registrar.singletonFactory(tokens.IActorDataExtractor, (c) => {
  return new ActorDataExtractor({
    anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
    entityFinder: c.resolve(tokens.IEntityManager),
  });
});
```

### Token Location
`src/dependencyInjection/tokens/tokens-ai.js` (line 49)
```javascript
IActorDataExtractor: 'IActorDataExtractor',
```

### Key Observations
1. **Currently uses singletonFactory** - service is instantiated once per container
2. **Dependency resolution is implicit** - relies on token resolution, no validation
3. **Easy to extend** - adding new dependencies is straightforward (add parameter, add resolve line)
4. **Pattern is consistent** - other services in same file follow identical pattern

---

## 6. Readiness Assessment

### ✅ What's Ready for Integration

| Item | Status | Notes |
|------|--------|-------|
| ActorDataExtractor class structure | ✅ | Simple constructor, easy to extend |
| extractPromptData() method | ✅ | Already accepts actorId parameter |
| InjuryAggregationService | ✅ | Fully implemented with InjurySummaryDTO |
| InjuryNarrativeFormatterService | ✅ | Fully implemented with formatting methods |
| DI infrastructure | ✅ | Registration pattern established |
| Test framework | ✅ | 67+ tests with comprehensive patterns |
| Entity access pattern | ✅ | Already uses entityFinder for lookups |

### ⚠️ What Needs to be Added

| Item | Status | Notes |
|------|--------|-------|
| ActorHealthStateDTO | ❌ | Needs to be created in AIGameStateDTO.js |
| ActorInjuryDTO | ❌ | Needs to be created in AIGameStateDTO.js |
| Health properties in ActorPromptDataDTO | ❌ | Needs to be added to typedef |
| Injury extraction logic in extractPromptData() | ❌ | New implementation needed |
| New dependency: InjuryAggregationService | ❌ | Needs to be added to constructor |
| DI registration updates | ❌ | Need to inject new services |
| Test cases for health/injury extraction | ❌ | Need new test suite |

---

## 7. Code Integration Points

### 7.1 Constructor Extension Pattern

**Current**:
```javascript
constructor({ anatomyDescriptionService, entityFinder }) {
  super();
  this.anatomyDescriptionService = anatomyDescriptionService;
  this.entityFinder = entityFinder;
}
```

**Proposed Pattern for New Dependencies**:
```javascript
constructor({ 
  anatomyDescriptionService, 
  entityFinder,
  injuryAggregationService,        // NEW
  injuryNarrativeFormatterService  // NEW (optional)
}) {
  super();
  this.anatomyDescriptionService = anatomyDescriptionService;
  this.entityFinder = entityFinder;
  this.injuryAggregationService = injuryAggregationService;        // NEW
  this.injuryNarrativeFormatterService = injuryNarrativeFormatterService; // NEW
}
```

### 7.2 extractPromptData() Extension Pattern

**Current Pattern Example** (how anatomy description is handled):
```javascript
// Only runs if actorId is provided
if (actorId && this.anatomyDescriptionService && this.entityFinder) {
  try {
    const actorEntity = this.entityFinder.getEntityInstance(actorId);
    if (actorEntity && actorEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      // Access component data
      const descComponent = actorEntity.getComponentData(DESCRIPTION_COMPONENT_ID);
      if (descComponent && descComponent.text && descComponent.text.trim()) {
        baseDescription = descComponent.text;
      }
    }
  } catch (error) {
    // Silently handle errors to maintain stability
  }
}
```

**Pattern for New Injury Extraction**:
```javascript
// Extract injury summary
if (actorId && this.injuryAggregationService) {
  try {
    const injurySummary = this.injuryAggregationService.aggregateInjuries(actorId);
    if (injurySummary) {
      // Format and/or include injury data in promptData
      // Option 1: Include raw InjurySummaryDTO
      promptData.healthState = injurySummary;
      
      // Option 2: Format as narrative
      if (this.injuryNarrativeFormatterService) {
        promptData.injuryNarrative = this.injuryNarrativeFormatterService.formatFirstPerson(injurySummary);
      }
    }
  } catch (error) {
    // Silently handle errors to maintain stability
  }
}
```

### 7.3 DI Registration Extension

**Current** (aiRegistrations.js):
```javascript
registrar.singletonFactory(tokens.IActorDataExtractor, (c) => {
  return new ActorDataExtractor({
    anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
    entityFinder: c.resolve(tokens.IEntityManager),
  });
});
```

**Extended**:
```javascript
registrar.singletonFactory(tokens.IActorDataExtractor, (c) => {
  return new ActorDataExtractor({
    anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
    entityFinder: c.resolve(tokens.IEntityManager),
    injuryAggregationService: c.resolve(tokens.InjuryAggregationService),
    injuryNarrativeFormatterService: c.resolve(tokens.InjuryNarrativeFormatterService),
  });
});
```

---

## 8. Ticket Assumption Validation

### Assumption 1: ActorDataExtractor is ready to accept new dependencies
✅ **VERIFIED**: Constructor is simple, easily extensible pattern already established.

### Assumption 2: InjuryAggregationService exists
✅ **VERIFIED**: Service exists at `src/anatomy/services/injuryAggregationService.js` with well-defined InjurySummaryDTO.

### Assumption 3: InjuryNarrativeFormatterService exists  
✅ **VERIFIED**: Service exists at `src/anatomy/services/injuryNarrativeFormatterService.js` with formatFirstPerson() method.

### Assumption 4: Health-related DTOs already exist
❌ **INVALIDATED**: No ActorHealthStateDTO or ActorInjuryDTO exist. These need to be created.

### Assumption 5: ActorPromptDataDTO includes health properties
❌ **INVALIDATED**: ActorPromptDataDTO has 21 properties, none health-related.

### Assumption 6: Test framework is ready
✅ **VERIFIED**: 67+ existing tests with clear patterns for new health-related tests.

---

## 9. Implementation Checklist

### Phase 1: DTOs & Types
- [ ] Create ActorHealthStateDTO typedef in AIGameStateDTO.js
- [ ] Create ActorInjuryDTO typedef in AIGameStateDTO.js  
- [ ] Add health properties to ActorPromptDataDTO
- [ ] Document all typedef properties with JSDoc comments

### Phase 2: Service Extension
- [ ] Add InjuryAggregationService dependency to ActorDataExtractor constructor
- [ ] Add InjuryNarrativeFormatterService dependency to ActorDataExtractor constructor
- [ ] Implement injury extraction logic in extractPromptData()
- [ ] Add error handling with try-catch pattern

### Phase 3: DI Registration
- [ ] Update aiRegistrations.js to inject new services
- [ ] Verify token resolution in DI container
- [ ] Test dependency injection

### Phase 4: Testing
- [ ] Create unit tests for health data extraction
- [ ] Create tests for injury summary integration
- [ ] Test error scenarios (null summary, missing service, etc.)
- [ ] Verify all existing tests still pass

### Phase 5: Validation
- [ ] Run full test suite
- [ ] Run ESLint on modified files
- [ ] Run type checking
- [ ] Verify schema validation (if applicable)

---

## 10. Files Requiring Changes

| File | Type | Purpose |
|------|------|---------|
| src/turns/dtos/AIGameStateDTO.js | Add typedefs | ActorHealthStateDTO, ActorInjuryDTO, update ActorPromptDataDTO |
| src/turns/services/actorDataExtractor.js | Modify class | Add dependencies, extend extractPromptData() |
| src/dependencyInjection/registrations/aiRegistrations.js | Modify registration | Inject new services |
| tests/unit/turns/services/actorDataExtractor.test.js | Add tests | Health extraction tests |

---

## Summary

The codebase is **well-prepared for this integration**. The two required services (InjuryAggregationService and InjuryNarrativeFormatterService) already exist with clean APIs. ActorDataExtractor follows established patterns that can easily accommodate new dependencies. The main work is:

1. **Add DTOs** to define health/injury data structures
2. **Extend ActorPromptDataDTO** to include health properties
3. **Modify ActorDataExtractor** to extract and include injury data
4. **Update DI registration** to inject the services
5. **Add comprehensive tests** for new functionality

All changes follow existing patterns and conventions in the codebase.
