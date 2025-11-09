# ANASYSIMP-004: Socket/Slot Compatibility Checker

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents socket resolution errors
**Status:** Not Started

## Context

From the anatomy system improvements analysis, blueprints can define `additionalSlots` that reference sockets on the root entity. However, there's no validation that these sockets actually exist, leading to runtime errors during slot processing.

**Example Error from Red Dragon:**
```
Error Round 6: "Socket 'fire_gland' not found on parent entity 'anatomy:dragon_torso'"
Location: Blueprint slot processing
Issue: Blueprint additionalSlots required sockets not on parent
Root Cause: No socket/slot compatibility validation
```

## Problem Statement

Blueprints specify `additionalSlots` that attach to sockets on the root entity. The current system:
- Accepts any socket name in blueprint definition
- Only validates socket existence during generation
- Provides unclear error messages about which sockets are available
- Requires manual inspection of entity files to find valid sockets

This causes late error discovery and unclear remediation paths.

## Solution Overview

Implement socket/slot compatibility validation that runs at recipe/blueprint load time. The validator should:
1. Verify blueprint's root entity exists
2. Extract available sockets from root entity's `anatomy:sockets` component
3. Validate that all `additionalSlots` reference valid sockets
4. Provide clear error messages listing available sockets
5. Suggest fixes (add socket to entity or remove from blueprint)

## Implementation Details

### Core Validation Function

```javascript
/**
 * Validates that blueprint additionalSlots reference valid sockets on root entity
 * @param {Object} blueprint - Blueprint to validate
 * @param {Object} dataRegistry - Data registry with entity definitions
 * @returns {Promise<Array<Object>>} Array of errors found
 */
async function validateSocketSlotCompatibility(blueprint, dataRegistry) {
  const errors = [];

  // Check if root entity exists
  const rootEntity = dataRegistry.getEntityDefinition(blueprint.root);

  if (!rootEntity) {
    errors.push({
      type: 'ROOT_ENTITY_NOT_FOUND',
      blueprintId: blueprint.id,
      rootEntityId: blueprint.root,
      message: `Root entity '${blueprint.root}' not found`,
      fix: `Create entity at data/mods/*/entities/definitions/${blueprint.root.split(':')[1]}.entity.json`,
      severity: 'error',
    });
    return errors; // Can't validate sockets without entity
  }

  // Extract available sockets from root entity
  const sockets = extractSocketsFromEntity(rootEntity);

  // Validate each additionalSlot references a valid socket
  for (const [slotName, slot] of Object.entries(blueprint.additionalSlots || {})) {
    if (!slot.socket) {
      errors.push({
        type: 'MISSING_SOCKET_REFERENCE',
        blueprintId: blueprint.id,
        slotName: slotName,
        message: `Slot '${slotName}' has no socket reference`,
        fix: `Add "socket" property to additionalSlots.${slotName}`,
        severity: 'error',
      });
      continue;
    }

    if (!sockets.has(slot.socket)) {
      errors.push({
        type: 'SOCKET_NOT_FOUND',
        blueprintId: blueprint.id,
        slotName: slotName,
        socketId: slot.socket,
        rootEntityId: blueprint.root,
        availableSockets: Array.from(sockets.keys()),
        message: `Socket '${slot.socket}' not found on root entity '${blueprint.root}'`,
        fix: suggestSocketFix(slot.socket, sockets, blueprint.root, rootEntity._sourceFile),
        severity: 'error',
      });
    }
  }

  // Also validate structure template slots (if they reference sockets)
  if (blueprint.structureTemplate) {
    errors.push(...validateStructureTemplateSockets(
      blueprint,
      sockets,
      rootEntity
    ));
  }

  return errors;
}

/**
 * Extracts socket information from entity
 * @param {Object} entity - Entity definition
 * @returns {Map<string, Object>} Map of socket ID to socket data
 */
function extractSocketsFromEntity(entity) {
  const socketsMap = new Map();

  // Check for anatomy:sockets component
  const socketsComponent = entity.components?.['anatomy:sockets'];

  if (!socketsComponent) {
    return socketsMap; // No sockets component
  }

  // Extract socket list
  const socketList = socketsComponent.sockets || [];

  for (const socket of socketList) {
    if (socket.id) {
      socketsMap.set(socket.id, {
        id: socket.id,
        orientation: socket.orientation,
        allowedTypes: socket.allowedTypes || [],
        nameTpl: socket.nameTpl,
        index: socket.index,
      });
    }
  }

  return socketsMap;
}

/**
 * Suggests how to fix socket mismatch
 * @param {string} requestedSocket - Socket ID that was requested
 * @param {Map} availableSockets - Available sockets on entity
 * @param {string} rootEntityId - Root entity ID
 * @param {string} entitySourceFile - Source filename of entity
 * @returns {string} Fix suggestion
 */
function suggestSocketFix(requestedSocket, availableSockets, rootEntityId, entitySourceFile) {
  if (availableSockets.size === 0) {
    return `Root entity has no sockets. Add anatomy:sockets component to entity file: ${entitySourceFile}`;
  }

  const socketList = Array.from(availableSockets.keys());

  // Try to find similar socket name
  const similar = findSimilarSocketName(requestedSocket, socketList);

  if (similar) {
    return `Socket '${requestedSocket}' not found. Did you mean '${similar}'? Available: [${socketList.join(', ')}]`;
  }

  return `Add socket '${requestedSocket}' to entity file '${entitySourceFile}' or use one of: [${socketList.join(', ')}]`;
}

/**
 * Finds similar socket name using string similarity
 * @param {string} requested - Requested socket name
 * @param {Array<string>} available - Available socket names
 * @returns {string|null} Most similar socket name or null
 */
function findSimilarSocketName(requested, available) {
  if (available.length === 0) return null;

  let closest = null;
  let minDistance = Infinity;

  for (const socket of available) {
    const distance = levenshteinDistance(
      requested.toLowerCase(),
      socket.toLowerCase()
    );

    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      closest = socket;
    }
  }

  return closest;
}

/**
 * Validates structure template slot socket references
 * @param {Object} blueprint - Blueprint definition
 * @param {Map} availableSockets - Available sockets
 * @param {Object} rootEntity - Root entity
 * @returns {Array<Object>} Array of errors
 */
function validateStructureTemplateSockets(blueprint, availableSockets, rootEntity) {
  const errors = [];

  // Structure templates define slots that may reference sockets
  // This validation depends on structure template implementation
  // For now, this is a placeholder for future enhancement

  return errors;
}

/**
 * Calculates Levenshtein distance between two strings
 * (Same implementation as in ANASYSIMP-002)
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

### Integration with Pre-flight Validator

```javascript
// In RecipePreflightValidator (ANASYSIMP-003)
async #checkSocketSlotCompatibility(recipe, results) {
  try {
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);
    if (!blueprint) return; // Already caught by blueprint check

    const errors = await validateSocketSlotCompatibility(blueprint, this.#dataRegistry);

    if (errors.length === 0) {
      const socketCount = this.#countAdditionalSlots(blueprint);
      results.passed.push({
        check: 'socket_slot_compatibility',
        message: `All ${socketCount} additionalSlot socket references valid`,
      });
    } else {
      results.errors.push(...errors);
    }
  } catch (error) {
    this.#logger.error('Socket/slot compatibility check failed', error);
    results.errors.push({
      type: 'VALIDATION_ERROR',
      check: 'socket_slot_compatibility',
      message: 'Failed to validate socket/slot compatibility',
      error: error.message,
    });
  }
}
```

### File Structure

```
src/anatomy/validation/
├── socketSlotCompatibilityValidator.js  # Main validator
├── socketExtractor.js                   # Socket extraction utilities
└── validationErrors.js                  # Error classes

tests/unit/anatomy/validation/
├── socketSlotCompatibilityValidator.test.js
└── socketExtractor.test.js

tests/integration/anatomy/validation/
└── socketSlotCompatibility.integration.test.js
```

## Acceptance Criteria

- [ ] Validator checks root entity exists
- [ ] Validator extracts sockets from entity's anatomy:sockets component
- [ ] Validator detects missing socket references in additionalSlots
- [ ] Validator detects invalid socket IDs
- [ ] Errors list available sockets
- [ ] Errors suggest similar socket names when available
- [ ] Errors include entity file path for fixes
- [ ] Validator handles entities without anatomy:sockets component
- [ ] Validator handles blueprints without additionalSlots
- [ ] Integration with ANASYSIMP-003 pre-flight validator works correctly
- [ ] All existing blueprints pass validation (no false positives)

## Testing Requirements

### Unit Tests

1. **Root Entity Validation**
   - Blueprint with non-existent root entity → error
   - Blueprint with valid root entity → passes

2. **Socket Extraction**
   - Entity with anatomy:sockets → extracts all sockets
   - Entity without anatomy:sockets → returns empty map
   - Entity with empty sockets array → returns empty map
   - Socket data includes id, orientation, allowedTypes, nameTpl, index

3. **Socket Reference Validation**
   - additionalSlot with valid socket → no error
   - additionalSlot with invalid socket → error with suggestions
   - additionalSlot without socket property → error
   - Multiple additionalSlots, one invalid → only one error

4. **Error Messages**
   - Error includes blueprint ID
   - Error includes slot name
   - Error includes socket ID
   - Error includes available sockets list
   - Error suggests similar socket name when close match exists

5. **Socket Similarity**
   - "fire_glan" → suggests "fire_gland"
   - "had" → suggests "head"
   - No close matches → lists all available
   - Case-insensitive matching

6. **Edge Cases**
   - Blueprint with no additionalSlots → no errors
   - Root entity with no sockets component → error if slots defined
   - Empty additionalSlots object → no errors

### Integration Tests

1. **Real Blueprint Validation**
   - Test with actual blueprint files
   - Test with actual entity definitions
   - Verify socket extraction from real entities

2. **Pre-flight Integration**
   - Socket validation runs as part of pre-flight validation
   - Errors appear in validation report correctly
   - Passed checks tracked correctly

3. **Multi-Error Scenarios**
   - Multiple invalid sockets → all reported
   - Invalid socket + missing root entity → both reported

## Documentation Requirements

- [ ] Add JSDoc comments to validation functions
- [ ] Document socket/slot compatibility in validation workflow docs
- [ ] Add example error messages to common errors catalog
- [ ] Update recipe creation checklist with socket compatibility requirement
- [ ] Document anatomy:sockets component structure

## Dependencies

**Required:**
- Data registry with `getEntityDefinition(entityId)` method (or `get('entityDefinitions', entityId)`)
- Anatomy blueprint repository with `getBlueprint(blueprintId)` async method

**Depends On:**
- None (independent validator)

**Integrates With:**
- ANASYSIMP-003 (Pre-flight Recipe Validator) - uses this

**Blocks:**
- ANASYSIMP-003 completion (optional integration point)

## Implementation Notes

### Entity Socket Component Structure

```json
{
  "anatomy:sockets": {
    "sockets": [
      {
        "id": "head",
        "orientation": "upper",
        "allowedTypes": ["head", "neck"],
        "nameTpl": "{{type}}"
      },
      {
        "id": "fire_gland",
        "allowedTypes": ["internal_organ"],
        "nameTpl": "{{type}}",
        "index": 1
      }
    ]
  }
}
```

**Note**: Socket properties are:
- `id` (required): Unique identifier for the socket
- `orientation` (optional): Spatial orientation (left, right, front, back, etc.)
- `allowedTypes` (required): Array of part types that can attach
- `nameTpl` (optional): Template for auto-naming attached parts
- `index` (optional): Sequential index for template substitution

**IMPORTANT**: Sockets do NOT have `type`, `capacity`, or `description` properties in the actual implementation.

### Error Message Template

```
[ERROR] Socket not found on root entity

Context:  Blueprint 'anatomy:red_dragon', Slot 'internal_fire'
Problem:  Socket 'fire_gland' not found on root entity 'anatomy:dragon_torso'
Impact:   Slot processing will fail during anatomy generation
Fix:      Add socket 'fire_gland' to data/mods/anatomy/entities/definitions/dragon_torso.entity.json

Available Sockets:
  - head
  - neck
  - torso_front
  - torso_rear
  - wing_left
  - wing_right
  - leg_left_front
  - leg_right_front
  - leg_left_rear
  - leg_right_rear
  - tail

Suggestion: Add to dragon_torso.entity.json:
{
  "anatomy:sockets": {
    "sockets": [
      ...existing sockets...,
      {
        "id": "fire_gland",
        "allowedTypes": ["internal_organ"],
        "nameTpl": "{{type}}"
      }
    ]
  }
}
```

### Performance Considerations

- Validation runs once per blueprint at load time
- Socket extraction: O(n) where n = number of sockets
- Socket lookup: O(1) with Map
- Expected blueprint size: 0-20 additional slots
- Performance impact: negligible (<5ms per blueprint)

## Success Metrics

- **Error Detection:** 100% of socket/slot mismatches caught at load time
- **False Positives:** 0% (all existing blueprints pass)
- **Error Clarity:** >90% of errors include actionable fix suggestions
- **Suggestion Accuracy:** >80% of similar socket suggestions are correct
- **Time Savings:** 20-30 minutes per socket error (eliminated entity file inspection)

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.6
- **Report Pages:** Lines 622-666
- **Error Examples:** Red Dragon Error Round 6 (lines 226-233)
- **Related Validators:** Pre-flight Recipe Validator (ANASYSIMP-003)
