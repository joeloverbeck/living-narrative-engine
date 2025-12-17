# Sense-Aware Perceptible Event System - Design Specification

## Problem Statement

When actions occur in the Living Narrative Engine (e.g., "Bob does a handstand"), ALL entities in the location receive the exact same `description_text` in their perception log, regardless of:
- **Lighting conditions** (total darkness should prevent visual perception)
- **Sensory organ status** (destroyed eyes should prevent seeing)

This breaks immersion. Characters in total darkness shouldn't receive messages like "{actor} does a handstand" when they realistically couldn't see it.

## Solution Overview

Create a **sense-aware perceptible event system** that:
1. Categorizes perception types by **required sense** (visual, auditory, olfactory, tactile, proprioceptive, omniscient)
2. Supports **alternate message templates** for different sensory contexts
3. **Filters events** based on recipient capabilities (lighting + anatomy)
4. Maintains **full backward compatibility** with existing rules

---

## Sense Categories

| Category | Requirements | Example Events |
|----------|--------------|----------------|
| `visual` | Light + functioning eyes | Movement, gestures, physical actions |
| `auditory` | Functioning ears | Speech, sounds, music |
| `olfactory` | Functioning nose | Smells, scents |
| `tactile` | Physical contact | Touch, direct interaction |
| `proprioceptive` | Self only | Own actions, internal states |
| `omniscient` | Always delivered | System messages, errors |

---

## Implementation Phases

### Phase 1: Foundation (Sense Categories + Registry)

**Goal**: Add sense metadata to perception types without changing behavior.

#### 1.1 Schema Changes

**File**: `data/schemas/common.schema.json`
- Add `senseCategory` enum definition

#### 1.2 Registry Enhancement

**File**: `src/perception/registries/perceptionTypeRegistry.js`
- Add `primarySense` and `fallbackSenses` to each type entry
- Add helper functions: `getPrimarySense()`, `getFallbackSenses()`, `requiresVisual()`, `isOmniscient()`

**Sense Mappings for All 32 Types**:
```
communication.speech    → auditory [tactile]
communication.thought   → proprioceptive []
communication.notes     → visual [tactile]
movement.arrival        → visual [auditory, tactile]
movement.departure      → visual [auditory]
combat.attack           → visual [auditory, tactile]
combat.damage           → visual [auditory, tactile]
combat.death            → visual [auditory]
combat.violence         → visual [auditory, tactile]
item.pickup             → visual [auditory]
item.drop               → auditory [visual]  // Thud is primary
item.transfer           → visual [auditory]
item.use                → visual [auditory]
item.examine            → visual []
container.open          → visual [auditory]
container.take          → visual [auditory]
container.put           → visual [auditory]
connection.lock         → auditory [visual]
connection.unlock       → auditory [visual]
consumption.consume     → visual [auditory]
state.observable_change → visual [auditory]
social.gesture          → visual []
social.affection        → visual [tactile]
social.interaction      → visual [auditory, tactile]
physical.self_action    → visual [auditory, tactile]
physical.target_action  → visual [auditory, tactile]
intimacy.sexual         → tactile [visual, auditory]
intimacy.sensual        → tactile [visual, auditory]
performance.music       → auditory [tactile]
performance.dance       → visual [auditory]
magic.spell             → visual [auditory, olfactory]
magic.ritual            → visual [auditory, olfactory]
error.system_error      → omniscient []
error.action_failed     → omniscient []
```

---

### Phase 2: New Services

#### 2.1 SensoryCapabilityService

**File**: `src/perception/services/sensoryCapabilityService.js` (NEW)

**Purpose**: Query an entity's sensory capabilities from anatomy.

```javascript
class SensoryCapabilityService {
  getSensoryCapabilities(entityId) → {
    canSee: boolean,    // Has functioning eyes
    canHear: boolean,   // Has functioning ears
    canSmell: boolean,  // Has functioning nose
    canFeel: boolean,   // Has tactile sense (always true)
    availableSenses: string[]
  }
}
```

**Logic**:
1. Check for `perception:sensory_capability` override component (manual mode)
2. Otherwise, query anatomy via `BodyGraphService.findPartsByType()`
3. Check `anatomy:part_health.state !== 'destroyed'` for sensory organs
4. No anatomy = assume all senses available (backward compatibility)

#### 2.2 PerceptionFilterService

**File**: `src/perception/services/perceptionFilterService.js` (NEW)

**Purpose**: Determine what description each recipient should receive.

```javascript
class PerceptionFilterService {
  filterEventForRecipients(eventData, recipientIds, locationId) → [
    { entityId, descriptionText, sense, canPerceive }
  ]
}
```

**Logic per recipient**:
1. Get perception type metadata (primarySense, fallbackSenses)
2. Check location lighting (for visual sense)
3. Get recipient's sensory capabilities
4. If primary sense available → use `description_text`
5. If fallback sense available → use `alternate_descriptions[sense]`
6. If `alternate_descriptions.limited` exists → use that
7. Otherwise → `canPerceive: false`

---

### Phase 3: Schema & Handler Changes

#### 3.1 Extended Operation Schema

**File**: `data/schemas/operations/dispatchPerceptibleEvent.schema.json`

Add new optional fields:
```json
{
  "alternate_descriptions": {
    "type": "object",
    "properties": {
      "auditory": { "type": "string" },
      "tactile": { "type": "string" },
      "olfactory": { "type": "string" },
      "limited": { "type": "string" }
    }
  },
  "sense_aware": {
    "type": "boolean",
    "default": true
  }
}
```

#### 3.2 Handler Modifications

**File**: `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- Inject `PerceptionFilterService`
- Before building `componentSpecs`, call `filterEventForRecipients()`
- Build per-recipient entries with filtered `descriptionText`
- Add `perceivedVia` field to log entry for debugging

**File**: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- Pass `alternate_descriptions` and `sense_aware` to log handler

---

### Phase 4: Component & DI Registration

#### 4.1 New Component

**File**: `data/mods/perception/components/sensory_capability.component.json` (NEW)

Optional override component for non-anatomical entities:
```json
{
  "id": "perception:sensory_capability",
  "dataSchema": {
    "properties": {
      "canSee": { "type": "boolean", "default": true },
      "canHear": { "type": "boolean", "default": true },
      "canSmell": { "type": "boolean", "default": true },
      "canFeel": { "type": "boolean", "default": true },
      "overrideMode": { "enum": ["auto", "manual"], "default": "auto" }
    }
  }
}
```

#### 4.2 DI Registration

**Files**:
- `src/dependencyInjection/tokens/tokens-core.js` - Add tokens
- `src/dependencyInjection/registrations/serviceRegistrations.js` - Register services

---

## Backward Compatibility

**Existing rules work unchanged because**:
1. `sense_aware` defaults to `true`
2. If no `alternate_descriptions` provided, uses primary text only
3. If primary sense unavailable with no fallback, event is silently filtered
4. `sense_aware: false` bypasses all filtering (debugging/special cases)

**Migration path for rules**:
```json
// Before (works unchanged)
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "description_text": "{context.actorName} does a handstand.",
    "perception_type": "physical.self_action"
  }
}

// After (enhanced version)
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "description_text": "{context.actorName} does a handstand, balancing upside-down.",
    "alternate_descriptions": {
      "auditory": "You hear sounds of exertion and shuffling nearby.",
      "tactile": "You feel vibrations through the floor from movement.",
      "limited": "You sense activity nearby."
    },
    "perception_type": "physical.self_action"
  }
}
```

---

## Critical Files to Modify

| File | Change Type |
|------|-------------|
| `data/schemas/common.schema.json` | Add senseCategory definition |
| `src/perception/registries/perceptionTypeRegistry.js` | Add sense fields + helpers |
| `src/perception/services/sensoryCapabilityService.js` | NEW |
| `src/perception/services/perceptionFilterService.js` | NEW |
| `data/schemas/operations/dispatchPerceptibleEvent.schema.json` | Add alternate_descriptions |
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | Add new fields |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Integrate filter service |
| `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` | Pass new fields |
| `src/dependencyInjection/tokens/tokens-core.js` | Add service tokens |
| `src/dependencyInjection/registrations/serviceRegistrations.js` | Register services |
| `data/mods/perception/components/sensory_capability.component.json` | NEW |
| `data/mods/perception/mod-manifest.json` | NEW (or update existing) |

---

## Testing Strategy

**Unit Tests**:
- `SensoryCapabilityService` with various anatomy configurations
- `PerceptionFilterService` with all sense/lighting combinations
- Registry helper functions

**Integration Tests**:
- Dark location + visual event = filtered or uses fallback
- Blind entity + visual event = uses auditory/tactile fallback
- Actor always perceives own proprioceptive events
- Multiple recipients get different descriptions based on capabilities

---

## Design Decisions (User Confirmed)

1. **Silent filtering**: When no fallback exists and the recipient can't perceive via any sense, the event is **completely silent** (no log entry created)
2. **Mod organization**: Create a **new `perception` mod** at `data/mods/perception/` with its own manifest and component
3. **No caching**: Sensory capabilities are **recomputed per event** - simpler implementation, always accurate, anatomy changes immediately reflected

---

## Execution Order

### Step 1: Schema & Registry (No behavioral change)
1. Add `senseCategory` to `common.schema.json`
2. Add `primarySense`/`fallbackSenses` to all types in `perceptionTypeRegistry.js`
3. Add helper functions to registry
4. Write unit tests for registry changes

### Step 2: New Services
1. Create `src/perception/services/sensoryCapabilityService.js`
2. Create `src/perception/services/perceptionFilterService.js`
3. Register in DI container
4. Write unit tests for both services

### Step 3: New Perception Mod
1. Create `data/mods/perception/mod-manifest.json`
2. Create `data/mods/perception/components/sensory_capability.component.json`
3. Update `game.json` to include perception mod (after anatomy, before core actions)

### Step 4: Operation Schema Extensions
1. Extend `dispatchPerceptibleEvent.schema.json` with `alternate_descriptions`, `sense_aware`
2. Extend `addPerceptionLogEntry.schema.json` with new fields

### Step 5: Handler Integration
1. Modify `addPerceptionLogEntryHandler.js` to use `PerceptionFilterService`
2. Modify `dispatchPerceptibleEventHandler.js` to pass new fields
3. Write integration tests

### Step 6: Example Enhanced Rule
1. Create one example rule with `alternate_descriptions` to demonstrate the pattern
2. Document migration guide for other rules
