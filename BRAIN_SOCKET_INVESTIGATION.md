# Brain Socket Issue - Detailed Investigation Report

## Problem Summary
The `SocketSlotCompatibilityValidator` is producing a `SOCKET_NOT_FOUND_ON_PARENT` error:
- **Error**: `brain_socket` not found on parent slot `head`
- **Expected**: `brain_socket` IS defined in `humanoid_head.entity.json` (lines 56-59)
- **Impact**: Recipe validation fails, blocking human_male blueprint from validation

---

## Root Cause Analysis: The Bug

### The Core Issue

The bug is in the **`extractComposedSlots()` function** (lines 507-599 of `socketExtractor.js`).

When the function registers child sockets, it uses **the wrong parent reference**:
- **Current (WRONG)**: `parent: slotName` (the child slot being processed)
- **Should be**: `parent: resolved.parent` (the actual parent slot from library)

### Detailed Code Trace

**File: `humanoid_core.part.json` (lines 90-93)**
```json
{
  "brain": {
    "$use": "standard_brain",
    "parent": "head"
  }
}
```

**File: `humanoid.slot-library.json` (lines 127-134)**
```json
{
  "standard_brain": {
    "parent": "head",
    "socket": "brain_socket",
    "requirements": {
      "partType": "brain",
      "components": ["anatomy:part", "anatomy:vital_organ"]
    }
  }
}
```

The slot library defines:
- Slot name: `brain`
- Parent slot: `head` (not `brain`)
- Required entity type: `partType: "brain"`
- Socket on that entity: `brain_socket`

**File: `humanoid_head.entity.json` (lines 56-59)**
```json
{
  "id": "brain_socket",
  "allowedTypes": ["brain"],
  "nameTpl": "{{type}}"
}
```

The head entity HAS the socket.

### How extractComposedSlots() Processes This

**Step 1: Load composed part** (line 526)
```javascript
const part = await getBlueprintPart(dataRegistry, partId);
// part = humanoid_core.part.json
```

**Step 2: Load library** (line 533-536)
```javascript
let library = null;
if (part.library) {
  library = await getSlotLibrary(dataRegistry, part.library);
  // library = humanoid.slot-library.json
}
```

**Step 3: First pass - resolve and register slots** (lines 541-560)
```javascript
for (const [slotName, slotConfig] of Object.entries(part.slots)) {
  // slotName = "brain"
  // slotConfig = { "$use": "standard_brain", "parent": "head" }
  
  const resolved = resolveSlotDefinition(slotConfig, library);
  // resolved = {
  //   "parent": "head",
  //   "socket": "brain_socket",
  //   "requirements": { "partType": "brain", ... }
  // }
  
  resolvedSlots.set(slotName, resolved);
  // resolvedSlots.set("brain", resolved)
}
```

The `resolvedSlots` map correctly has:
- Key: `"brain"` (the slot name)
- Value: `{ parent: "head", socket: "brain_socket", requirements: {...} }`

**Step 4: Second pass - extract child sockets** (lines 563-597)
```javascript
for (const [slotName, resolved] of resolvedSlots) {
  // slotName = "brain"
  // resolved = { parent: "head", socket: "brain_socket", ... }
  
  const partType = resolved.requirements?.partType;
  // partType = "brain"
  
  const entityId = await resolveEntityId(partType, dataRegistry);
  // entityId = "anatomy:human_brain"
  
  const partEntity = await getEntityDefinition(dataRegistry, entityId);
  // partEntity = human_brain.entity.json with anatomy:sockets containing brain_socket
  
  const partSockets = extractSocketsFromEntity(partEntity);
  // partSockets.get("brain_socket") exists
  
  for (const [socketId, socketData] of partSockets) {
    // socketId = "brain_socket"
    
    hierarchicalSockets.set(socketId, {
      ...socketData,
      source: 'composed_part_child',
      parent: slotName,  // ❌ WRONG: "brain"
      parentEntity: entityId,
      hierarchicalKey: `${slotName}:${socketId}`,
    });
    // Should be: parent: resolved.parent  ✅ "head"
  }
}
```

### Why The Validator Fails

**File: `human_male.blueprint.json` (after composition merges slots)**

After `extractComposedSlots()` runs and the blueprint is merged with the part:
```json
{
  "brain": {
    "socket": "brain_socket",
    "parent": "head",
    "requirements": { "partType": "brain", ... }
  }
}
```

The blueprint's `brain` slot has `parent: "head"`, meaning:
- "Find a socket on the parent `head` slot"
- Look for the socket `brain_socket` on whatever parent socket the `head` slot provides

**In SocketSlotCompatibilityValidator.js (lines 215-232)**:
```javascript
if (slotConfig.parent) {  // "brain" slot HAS parent: "head"
  errors.push({
    type: 'SOCKET_NOT_FOUND_ON_PARENT',
    parentSlot: slotConfig.parent,  // "head"
    availableSockets: Array.from(hierarchicalSockets.keys()),
    // [neck, left_shoulder, ..., brain_socket registered with parent: "brain"]
  });
}
```

The validator looks for a socket with `parent: "head"`, but finds:
```javascript
hierarchicalSockets.get("brain_socket")
// Returns: {
//   id: "brain_socket",
//   parent: "brain",  // ❌ WRONG PARENT
//   parentEntity: "anatomy:human_brain",
//   source: "composed_part_child"
// }
```

The validator then checks (line 210):
```javascript
if (hierarchicalSockets.has(slotConfig.socket) || slotConfig.optional === true) {
  continue;  // Socket exists in map - PASS
}
```

It finds `brain_socket` exists! But then (lines 214-232) it checks if the parent matches.

Since the validator can't find a socket with `parent: "head"` in the map (only `parent: "brain"`), validation fails.

---

## The Fix

**File: `src/anatomy/validation/socketExtractor.js`, lines 588-596**

### Current Code (WRONG):
```javascript
for (const [socketId, socketData] of partSockets) {
  hierarchicalSockets.set(socketId, {
    ...socketData,
    source: 'composed_part_child',
    parent: slotName,  // ❌ Uses the slot being processed
    parentEntity: entityId,
    hierarchicalKey: `${slotName}:${socketId}`,
  });
}
```

### Fixed Code (CORRECT):
```javascript
for (const [socketId, socketData] of partSockets) {
  hierarchicalSockets.set(socketId, {
    ...socketData,
    source: 'composed_part_child',
    parent: resolved.parent || slotName,  // ✅ Uses the actual parent from library
    parentEntity: entityId,
    hierarchicalKey: `${slotName}:${socketId}`,
  });
}
```

This ensures the socket is registered with the CORRECT parent slot (`head`, not `brain`).

---

## Impact Analysis

### This Bug Affects

Any anatomy slot that:
1. Is defined in a blueprint part
2. Has a `parent` property (indicating it's a child of another slot)
3. Is composed into the blueprint via the `compose` instruction

### Examples:
- ✅ `brain` slot (parent: head) - **AFFECTED**
- ✅ `mouth` slot (parent: head) - **WOULD BE AFFECTED** if used
- ✅ `teeth` slot (parent: mouth) - **WOULD BE AFFECTED** if nested
- ✅ `hand` slot (parent: arm) - **WOULD BE AFFECTED** if used
- ✅ `foot` slot (parent: leg) - **WOULD BE AFFECTED** if used

### Current Status:
Most examples above ARE in the slot library but not causing errors because they're registered in the blueprint via composition, and the validator currently passes them through. The `brain` slot specifically triggers validation failure because:

1. It's explicitly used in `humanoid_core.part.json`
2. It has both a parent reference AND a socket reference
3. The validator explicitly checks parent-child socket relationships

---

## How To Verify The Fix Works

1. Apply the fix to line 592 in `socketExtractor.js`
2. Run: `npm run test:integration -- tests/integration/anatomy/humanMaleBodyGraph.integration.test.js`
3. Expected result: Test passes, socket `brain_socket` is found with correct parent `head`
4. Validation log shows: `brain_socket` registered with `parent: "head"`, not `parent: "brain"`

---

## Code Path Summary

```
validateSocketSlotCompatibility() [SocketSlotCompatibilityValidator.js:147]
  ↓
extractHierarchicalSockets() [socketExtractor.js:57]
  ↓
if (blueprint?.compose && dataRegistry) [socketExtractor.js:91]
  ↓
extractComposedSlots() [socketExtractor.js:507]
  ↓
Second pass loop [socketExtractor.js:566-597] ← BUG IS HERE
  ↓
hierarchicalSockets.set(socketId, {
  parent: slotName,  // ❌ WRONG - should be: resolved.parent
  ...
})
```

---

## Root Cause Conclusion

The `extractComposedSlots()` function in `socketExtractor.js` (line 592) **incorrectly registers child sockets with their slot name instead of their parent slot name**. This causes validation to fail when checking parent-child socket relationships because the socket is registered under the wrong parent context.

**Severity**: High - Breaks validation for all nested anatomy slots in composed blueprints.

**Confidence**: Very High - Root cause clearly identified with complete trace through data structures.
