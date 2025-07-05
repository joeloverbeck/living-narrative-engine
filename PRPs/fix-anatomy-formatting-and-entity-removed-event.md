name: "Fix Anatomy Formatting and Entity Removed Event Validation"
description: |

## Purpose
Fix two critical issues in the living-narrative-engine:
1. Anatomy visualizer incorrectly displays "Testicle:" instead of "Testicles:" for paired testicles
2. Validation errors for 'core:entity_removed' event due to payload mismatch between dispatch and schema

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Fix the anatomy formatting system to correctly pluralize paired body parts (specifically testicles) and resolve all validation errors for the 'core:entity_removed' event across the codebase.

## Why
- **Business value**: Improves accuracy of character descriptions and prevents error spam in console
- **User impact**: Users see correct anatomical descriptions and don't experience validation errors when switching entities
- **Integration**: Maintains consistency with existing anatomy and event systems
- **Problems solved**: Fixes incorrect pluralization and eliminates validation errors that clutter logs

## What
1. **Anatomy Formatting**: Paired body parts like testicles should display as "Testicles:" (plural) when there are two with the same description
2. **Event Validation**: All 'core:entity_removed' event dispatches must match the schema requiring `{ instanceId: string }`

### Success Criteria
- [ ] Testicles display as "Testicles: small, oval" (plural) when paired with same descriptors
- [ ] No validation errors for 'core:entity_removed' event in console
- [ ] All existing tests pass
- [ ] Integration tests verify correct pluralization

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/anatomy-formatting/default.json
  why: Contains pairedParts configuration including "testicle"
  
- file: /home/joeloverbeck/projects/living-narrative-engine/src/anatomy/templates/textFormatter.js
  why: Contains getPartLabel method that handles pluralization logic
  
- file: /home/joeloverbeck/projects/living-narrative-engine/src/anatomy/bodyDescriptionComposer.js
  why: Main composer that uses TextFormatter for labels
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/core/events/entity_removed.event.json
  why: Schema definition requiring instanceId in payload
  
- file: /home/joeloverbeck/projects/living-narrative-engine/src/entities/services/entityLifecycleManager.js
  why: Dispatches entity_removed with wrong payload format (line 275)

- file: /home/joeloverbeck/projects/living-narrative-engine/src/constants/eventIds.js
  why: Contains ENTITY_REMOVED_ID constant and typedef docs

- file: /home/joeloverbeck/projects/living-narrative-engine/src/services/anatomyFormattingService.js
  why: Loads and provides anatomy formatting configuration
```

### Known Gotchas of our codebase & Library Quirks
```javascript
// CRITICAL: AnatomyFormattingService must be initialized before use
// CRITICAL: TextFormatter.getPartLabel requires count > 1 AND part in pairedParts for pluralization
// CRITICAL: Event validation is strict - no additional properties allowed in payload
// CRITICAL: Some consumers expect entity object, others expect instanceId
```

### Research Findings

#### Issue 1: Testicle Pluralization
The anatomy formatting config correctly includes "testicle" in pairedParts:
```json
"pairedParts": ["eye", "ear", "arm", "leg", "hand", "foot", "breast", "wing", "testicle"]
```

The TextFormatter.getPartLabel logic:
```javascript
if (count > 1 && pairedParts.has(partType)) {
    const plural = pluralizer(partType);
    return this.capitalize(plural);
}
```

The issue might be:
1. AnatomyFormattingService not properly passing pairedParts to bodyDescriptionComposer
2. The bodyDescriptionComposer not using the anatomyFormattingService
3. A default pairedParts set being used that doesn't include "testicle"

#### Issue 2: Entity Removed Event
Current dispatch (WRONG):
```javascript
this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
    entity: entityToRemove,
});
```

Expected by schema:
```javascript
{
    "instanceId": "string"
}
```

Consumers affected:
- entityLifecycleMonitor.js - expects instanceId (correct)
- spatialIndexSynchronizer.js - expects entity (needs update)
- Test files - expect entity (need update)

## Implementation Blueprint

### List of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1: Debug and fix anatomy formatting configuration flow
MODIFY src/anatomy/bodyDescriptionComposer.js:
  - CHECK if anatomyFormattingService is properly injected
  - ENSURE getPairedParts() is called from service, not using defaults
  - ADD debug logging to verify pairedParts includes "testicle"

MODIFY src/anatomy/configuration/descriptionConfiguration.js:
  - VERIFY anatomyFormattingService is properly used
  - CHECK default pairedParts includes "testicle" as fallback

Task 2: Fix entity_removed event payload in dispatcher
MODIFY src/entities/services/entityLifecycleManager.js:
  - FIND line 275: dispatch(ENTITY_REMOVED_ID, { entity: entityToRemove })
  - CHANGE to: dispatch(ENTITY_REMOVED_ID, { instanceId: entityToRemove.id })

Task 3: Update consumers expecting entity object
MODIFY src/entities/spatialIndexSynchronizer.js:
  - FIND listener for ENTITY_REMOVED_ID
  - CHANGE from: const { entity } = payload
  - CHANGE to: const { instanceId } = payload
  - ADD: const entity = this.entityManager.get(instanceId) if needed

Task 4: Update test utilities and mocks
MODIFY tests/common/engine/dispatchTestUtils.js:
  - FIND createMockEntityRemovedPayload or similar
  - CHANGE payload from { entity } to { instanceId }

Task 5: Update test expectations
SEARCH for test files using ENTITY_REMOVED_ID:
  - tests/unit/domUI/entityLifecycleMonitor.test.js
  - tests/unit/entities/spatialIndexSynchronizer.test.js
  - UPDATE expectations to use instanceId instead of entity

Task 6: Add integration test for testicle pluralization
CREATE tests/integration/anatomy/testiclePluralization.integration.test.js:
  - TEST that paired testicles with same descriptors show as "Testicles:"
  - USE existing humanMaleBodyDescription.integration.test.js as pattern
```

### Per task pseudocode

#### Task 1: Debug anatomy formatting
```javascript
// In bodyDescriptionComposer.js constructor
constructor({ ..., anatomyFormattingService }) {
    this.anatomyFormattingService = anatomyFormattingService;
    
    // Debug logging
    if (this.anatomyFormattingService) {
        const pairedParts = this.anatomyFormattingService.getPairedParts();
        console.debug('BodyDescriptionComposer: pairedParts includes testicle:', pairedParts.has('testicle'));
    }
}

// In composeDescription method
const pairedParts = this.anatomyFormattingService?.getPairedParts() || this._getDefaultPairedParts();
// Ensure default includes testicle
```

#### Task 2: Fix entity_removed dispatch
```javascript
// In entityLifecycleManager.js removeEntityInstance method
// Change from:
this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
    entity: entityToRemove,
});

// To:
this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
    instanceId: entityToRemove.id,
});
```

#### Task 3: Update spatialIndexSynchronizer
```javascript
// In _setupEventListeners method
this.#eventDispatcher.addEventListener(ENTITY_REMOVED_ID, (payload) => {
    // Change from:
    // const { entity } = payload;
    
    // To:
    const { instanceId } = payload;
    // Remove entity from spatial index using instanceId
    this._removeEntityFromIndex(instanceId);
});
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors in the files you've modified before proceeding
npm run lint

# Expected: No errors in modified files
```

### Level 2: Unit Tests
```bash
# Run all tests to ensure no regressions
npm run test

# Run specific test suites for affected areas
npm test -- anatomy
npm test -- entity

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Testing
```bash
# Run anatomy visualizer in browser
# 1. Open anatomy-visualizer.html
# 2. Load a character with human_male blueprint
# 3. Verify "Testicles:" appears (plural) in description
# 4. Switch between entities
# 5. Verify NO validation errors in console for entity_removed
```

### Level 4: Manual Validation
1. Check error_logs.txt is not growing with entity_removed validation errors
2. Verify anatomy descriptions show correct pluralization for all paired parts

## Final validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors in modified files: `npm run lint`
- [ ] Testicles display as plural in anatomy visualizer
- [ ] No entity_removed validation errors in console
- [ ] error_logs.txt shows no new validation failures
- [ ] All existing functionality preserved

---

## Anti-Patterns to Avoid
- ❌ Don't modify the event schema - fix the dispatchers instead
- ❌ Don't add "testicles" as irregular plural - standard "s" pluralization works
- ❌ Don't skip updating tests - they'll catch regressions
- ❌ Don't remove validation - fix the root cause
- ❌ Don't hardcode pluralization - use configuration
- ❌ Don't catch and suppress validation errors - fix the payload

## Additional Notes

### Why the entity_removed payload mismatch exists
The codebase has evolved and the typedef documentation in eventIds.js shows `{ entity }` while the schema requires `{ instanceId }`. This suggests a refactoring was done to use instanceId but not all dispatchers were updated.

### Anatomy formatting service initialization
The anatomyFormattingService must be initialized before being used by bodyDescriptionComposer. Verify the initialization order in the dependency injection setup.

### Test data considerations
The human_male.blueprint.json should have two testicle sockets (left_testicle, right_testicle) that will be filled with testicle entities. Verify these exist and are properly configured.