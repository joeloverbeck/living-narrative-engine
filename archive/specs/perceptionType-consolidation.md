# Perception Type Consolidation Specification

## Overview

This specification defines the refactoring of the `perceptionType` system to provide:

1. A consolidated, coherent set of perception type values (32 types in 14 categories, reduced from 46)
2. Runtime validation with clear error messages and suggestions
3. perceptionType-based UI theming in the perception log renderer

## Problem Statement

### Current Issues

1. **Inconsistent Granularity**: Types like `liquid_consumed_entirely` are overly specific while `action_target_general` is too broad
2. **Redundant Pairs**: `item_pickup` vs `item_picked_up`, `item_drop` vs `item_dropped` create confusion
3. **No Runtime Validation**: Handler only checks for non-empty string, not enum membership
4. **UI Ignores perceptionType**: Styling is based on text pattern matching (regex for "says:" and asterisks)
5. **Overuse of Generic Types**: 215+ occurrences of `action_self_general`/`action_target_general` across diverse contexts

### Analysis Summary

- **Schema location**: `/data/schemas/common.schema.json` (lines 41-90)
- **Handler location**: `/src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- **Renderer location**: `/src/domUI/perceptionLogRenderer.js`
- **CSS location**: `/css/components/_perception-log.css`
- **Affected mod files**: ~186 rule files, ~30 macro files

## New Type Taxonomy

### Categories and Types (14 Categories, 32 Types)

| Category | Types | Theme Color | Hex | Use Case |
|----------|-------|-------------|-----|----------|
| communication | speech, thought, notes | Purple | #6a1b9a | Verbal/written communication |
| movement | arrival, departure | Blue | #1565c0 | Location changes |
| combat | attack, damage, death, violence | Red | #c62828 | Combat actions and results |
| item | pickup, drop, transfer, use, examine | Amber | #e65100 | Item manipulation |
| container | open, take, put | Brown | #795548 | Container operations |
| connection | lock, unlock | Steel | #546e7a | Locks/doors |
| consumption | consume | Green | #2e7d32 | Eating/drinking |
| state | observable_change | Cyan | #00838f | State transitions |
| social | gesture, affection, interaction | Pink | #ad1457 | Social actions |
| physical | self_action, target_action | Tan | #8d6e63 | General physical actions |
| intimacy | sexual, sensual | Rose | #c2185b | Intimate physical contact |
| performance | music, dance | Gold | #f9a825 | Artistic performances |
| magic | spell, ritual | Indigo | #5c6bc0 | Magical actions |
| error | system_error, action_failed | Dark Red | #b71c1c | Failures and errors |

### Type Format

All new types use dotted notation: `category.type` (e.g., `communication.speech`, `combat.attack`)

### Complete Type List

```
communication.speech
communication.thought
communication.notes
movement.arrival
movement.departure
combat.attack
combat.damage
combat.death
combat.violence
item.pickup
item.drop
item.transfer
item.use
item.examine
container.open
container.take
container.put
connection.lock
connection.unlock
consumption.consume
state.observable_change
social.gesture
social.affection
social.interaction
physical.self_action
physical.target_action
intimacy.sexual
intimacy.sensual
performance.music
performance.dance
magic.spell
magic.ritual
error.system_error
error.action_failed
```

## Legacy to New Type Mapping

### Direct Mappings (1:1 Correspondence)

| Legacy Type | New Type |
|-------------|----------|
| `speech_local` | `communication.speech` |
| `thought_internal` | `communication.thought` |
| `notes_jotted` | `communication.notes` |
| `character_enter` | `movement.arrival` |
| `character_exit` | `movement.departure` |
| `dimensional_arrival` | `movement.arrival` |
| `dimensional_departure` | `movement.departure` |
| `combat_attack` | `combat.attack` |
| `combat_effect` | `combat.damage` |
| `damage_received` | `combat.damage` |
| `entity_died` | `combat.death` |
| `item_pickup` | `item.pickup` |
| `item_picked_up` | `item.pickup` |
| `item_drop` | `item.drop` |
| `item_dropped` | `item.drop` |
| `item_transfer` | `item.transfer` |
| `item_use` | `item.use` |
| `item_examined` | `item.examine` |
| `item_read` | `item.examine` |
| `container_opened` | `container.open` |
| `item_taken_from_container` | `container.take` |
| `item_taken_from_nearby_surface` | `container.take` |
| `item_put_in_container` | `container.put` |
| `item_put_on_nearby_surface` | `container.put` |
| `connection_locked` | `connection.lock` |
| `connection_unlocked` | `connection.unlock` |
| `drink_consumed` | `consumption.consume` |
| `food_consumed` | `consumption.consume` |
| `liquid_consumed` | `consumption.consume` |
| `liquid_consumed_entirely` | `consumption.consume` |
| `rest_action` | `physical.self_action` |
| `state_change_observable` | `state.observable_change` |
| `error` | `error.system_error` |
| `connection_lock_failed` | `error.action_failed` |
| `connection_unlock_failed` | `error.action_failed` |
| `container_open_failed` | `error.action_failed` |
| `item_pickup_failed` | `error.action_failed` |
| `item_transfer_failed` | `error.action_failed` |
| `put_in_container_failed` | `error.action_failed` |
| `put_on_nearby_surface_failed` | `error.action_failed` |
| `take_from_container_failed` | `error.action_failed` |
| `take_from_nearby_surface_failed` | `error.action_failed` |

### Context-Aware Mappings (action_self_general / action_target_general)

These generic types must be mapped based on the containing mod folder:

| Mod Folder Pattern | New Type |
|--------------------|----------|
| `music` | `performance.music` |
| `ballet`, `gymnastics` | `performance.dance` |
| `weapons`, `ranged` | `combat.attack` |
| `violence` | `combat.violence` |
| `sex-*` (any sex-prefixed mod) | `intimacy.sexual` |
| `seduction` | `intimacy.sensual` |
| `warding`, `hexing` | `magic.spell` |
| `affection`, `hugging`, `hand-holding` | `social.affection` |
| `kissing`, `caressing` | `social.interaction` |
| `positioning`, `deference`, `recovery` | `physical.self_action` or `physical.target_action` |
| (default fallback) | `physical.target_action` |

**Decision Logic for self vs target**:
- If the action name contains "self", "own", or operates on the actor → `physical.self_action`
- Otherwise → `physical.target_action`

## Registry Architecture

### File: `src/perception/registries/perceptionTypeRegistry.js`

```javascript
/**
 * @file Central source of truth for perception type metadata
 * @description Provides type definitions, category information, and validation utilities
 */

export const PERCEPTION_TYPE_REGISTRY = {
  'communication.speech': {
    type: 'communication.speech',
    category: 'communication',
    displayLabel: 'Speech',
    cssClass: 'log-type-speech',
    legacyTypes: ['speech_local'],
    isFailure: false,
  },
  // ... all 32 types
};

export const PERCEPTION_CATEGORIES = {
  communication: {
    displayLabel: 'Communication',
    cssClassPrefix: 'log-cat-communication',
    themeColor: '#6a1b9a',
  },
  // ... all 14 categories
};

// Export utility functions
export function isValidPerceptionType(type) { ... }
export function getPerceptionTypeMetadata(type) { ... }
export function getCategoryMetadata(category) { ... }
export function suggestNearestType(invalidType) { ... }
export function getLegacyTypeMapping(legacyType) { ... }
export function getAllValidTypes() { ... }
export function getTypesByCategory(category) { ... }
```

### File: `src/perception/validators/perceptionTypeValidator.js`

```javascript
/**
 * @file Validation utilities for perception types
 * @description Provides validation with helpful error messages
 */

export function validatePerceptionType(type, context = {}) { ... }
export function createValidationError(invalidType, suggestion) { ... }
export function formatValidTypesMessage() { ... }
```

## Runtime Validation

### Handler Modification

**File**: `/src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

Add after existing string validation (around line 186):

```javascript
import {
  isValidPerceptionType,
  suggestNearestType,
  getLegacyTypeMapping,
  getAllValidTypes
} from '../../perception/registries/perceptionTypeRegistry.js';

// Check for legacy type and auto-migrate (with deprecation warning)
const legacyMapping = getLegacyTypeMapping(perception_type);
if (legacyMapping) {
  this.#logger.warn(
    `Deprecated perception_type '${perception_type}' used. ` +
    `Please migrate to '${legacyMapping}'. This type will be removed in a future version.`
  );
  perception_type = legacyMapping;
}

// Validate against registry
if (!isValidPerceptionType(perception_type)) {
  const suggestion = suggestNearestType(perception_type);
  const validTypes = getAllValidTypes().slice(0, 10).join(', ');
  safeDispatchError(
    this.#dispatcher,
    `Invalid perception_type '${perception_type}'. ` +
    `${suggestion ? `Did you mean '${suggestion}'? ` : ''}` +
    `Valid types include: ${validTypes}...`,
    { perception_type, suggestion },
    this.#logger
  );
  return;
}
```

## UI Theming

### CSS Variables

**File**: `/css/themes/_default-theme.css` (add to existing file or create)

```css
/* Perception Type Color Variables (WCAG AA compliant on parchment #fff8e6) */
:root {
  --perception-communication: #6a1b9a;  /* Purple */
  --perception-movement: #1565c0;       /* Blue */
  --perception-combat: #c62828;         /* Red */
  --perception-item: #e65100;           /* Amber */
  --perception-container: #795548;      /* Brown */
  --perception-connection: #546e7a;     /* Steel */
  --perception-consumption: #2e7d32;    /* Green */
  --perception-state: #00838f;          /* Cyan */
  --perception-social: #ad1457;         /* Pink */
  --perception-physical: #8d6e63;       /* Tan */
  --perception-intimacy: #c2185b;       /* Rose */
  --perception-performance: #f9a825;    /* Gold */
  --perception-magic: #5c6bc0;          /* Indigo */
  --perception-error: #b71c1c;          /* Dark Red */
}
```

### CSS Classes

**File**: `/css/components/_perception-log.css` (append to existing)

```css
/* ============================================
   PERCEPTION TYPE-BASED THEMING
   ============================================ */

/* Category Classes - Primary Color Theming */
.log-cat-communication { color: var(--perception-communication); }
.log-cat-movement { color: var(--perception-movement); }
.log-cat-combat { color: var(--perception-combat); font-weight: 500; }
.log-cat-item { color: var(--perception-item); }
.log-cat-container { color: var(--perception-container); }
.log-cat-connection { color: var(--perception-connection); }
.log-cat-consumption { color: var(--perception-consumption); }
.log-cat-state { color: var(--perception-state); }
.log-cat-social { color: var(--perception-social); }
.log-cat-physical { color: var(--perception-physical); }
.log-cat-intimacy { color: var(--perception-intimacy); }
.log-cat-performance { color: var(--perception-performance); }
.log-cat-magic { color: var(--perception-magic); font-style: italic; }
.log-cat-error { color: var(--perception-error); font-weight: 600; }

/* Type-Specific Refinements */
.log-type-speech .speaker-name { font-weight: 600; }
.log-type-thought { font-style: italic; opacity: 0.9; }
.log-type-death { font-weight: 700; text-transform: uppercase; }
.log-type-spell::before { content: '✨ '; }
.log-type-ritual::before { content: '🔮 '; }
.log-type-action_failed { text-decoration: line-through; opacity: 0.7; }
```

### Renderer Modification

**File**: `/src/domUI/perceptionLogRenderer.js`

Modify `_renderListItem()` method to use perceptionType for primary styling:

```javascript
import {
  getPerceptionTypeMetadata,
  getCategoryMetadata,
  getLegacyTypeMapping
} from '../perception/registries/perceptionTypeRegistry.js';

_renderListItem(logEntry, _itemIndex, _listData) {
  const li = document.createElement('li');
  li.setAttribute('role', 'listitem');

  const text = logEntry.descriptionText.trim();
  let perceptionType = logEntry.perceptionType || 'physical.target_action';

  // Handle legacy types
  const mappedType = getLegacyTypeMapping(perceptionType);
  if (mappedType) {
    perceptionType = mappedType;
  }

  // Apply perceptionType-based classes (PRIMARY styling mechanism)
  const typeMetadata = getPerceptionTypeMetadata(perceptionType);
  if (typeMetadata) {
    li.classList.add(typeMetadata.cssClass);
    const categoryMetadata = getCategoryMetadata(typeMetadata.category);
    if (categoryMetadata) {
      li.classList.add(categoryMetadata.cssClassPrefix);
    }
  }

  // Text pattern detection for additional formatting (speaker name extraction, etc.)
  let innerFragments = [];

  if (perceptionType === 'communication.speech' || perceptionType.startsWith('communication.')) {
    // Speech handling - extract speaker name if present
    const speechMatch = text.match(/^([^:]+?)\s+says:\s*(.+)$/i);
    if (speechMatch) {
      const [, speaker, dialogue] = speechMatch;
      innerFragments.push(
        `<span class="speaker-name">${this.#escapeHtml(speaker)}</span> says: `,
        `<span class="dialogue">"${this.#escapeHtml(dialogue)}"</span>`
      );
    } else {
      innerFragments.push(this.#escapeHtml(text));
    }
  } else if (/^\*[^*]+\*$/.test(text)) {
    // Action text (surrounded by asterisks)
    const actionText = text.slice(1, -1);
    innerFragments.push(`<em class="action-text">${this.#escapeHtml(actionText)}</em>`);
  } else {
    innerFragments.push(this.#escapeHtml(text));
  }

  li.innerHTML = innerFragments.join('');
  return li;
}
```

## Schema Updates

### File: `/data/schemas/common.schema.json`

**Phase 1**: Add new types while keeping legacy (backward compatibility)

```json
"perceptionType": {
  "description": "Standardized category identifiers for perceptible events. New format: 'category.type'. Legacy snake_case types are deprecated.",
  "type": "string",
  "enum": [
    "communication.speech",
    "communication.thought",
    "communication.notes",
    "movement.arrival",
    "movement.departure",
    "combat.attack",
    "combat.damage",
    "combat.death",
    "combat.violence",
    "item.pickup",
    "item.drop",
    "item.transfer",
    "item.use",
    "item.examine",
    "container.open",
    "container.take",
    "container.put",
    "connection.lock",
    "connection.unlock",
    "consumption.consume",
    "state.observable_change",
    "social.gesture",
    "social.affection",
    "social.interaction",
    "physical.self_action",
    "physical.target_action",
    "intimacy.sexual",
    "intimacy.sensual",
    "performance.music",
    "performance.dance",
    "magic.spell",
    "magic.ritual",
    "error.system_error",
    "error.action_failed",

    "__DEPRECATED_LEGACY_TYPES_BELOW__",
    "action_self_general",
    "action_target_general",
    "character_enter",
    "character_exit",
    "combat_attack",
    "combat_effect",
    "connection_lock_failed",
    "connection_locked",
    "connection_unlock_failed",
    "connection_unlocked",
    "container_open_failed",
    "container_opened",
    "damage_received",
    "dimensional_arrival",
    "dimensional_departure",
    "drink_consumed",
    "entity_died",
    "error",
    "food_consumed",
    "item_drop",
    "item_dropped",
    "item_examined",
    "item_pickup",
    "item_pickup_failed",
    "item_picked_up",
    "item_put_in_container",
    "item_put_on_nearby_surface",
    "item_read",
    "item_taken_from_container",
    "item_taken_from_nearby_surface",
    "item_transfer",
    "item_transfer_failed",
    "item_use",
    "liquid_consumed",
    "liquid_consumed_entirely",
    "notes_jotted",
    "put_in_container_failed",
    "put_on_nearby_surface_failed",
    "rest_action",
    "speech_local",
    "state_change_observable",
    "take_from_container_failed",
    "take_from_nearby_surface_failed",
    "thought_internal"
  ]
}
```

**Phase 2** (after migration complete): Remove legacy types

## Migration Script

### File: `scripts/migratePerceptionTypes.js`

```javascript
#!/usr/bin/env node

/**
 * Migration script for perception types
 *
 * Usage:
 *   node scripts/migratePerceptionTypes.js --dry-run    # Preview changes
 *   node scripts/migratePerceptionTypes.js              # Apply changes
 *   node scripts/migratePerceptionTypes.js --report     # Generate report only
 */

const fs = require('fs');
const path = require('path');

// Direct mappings
const DIRECT_MAPPINGS = {
  'speech_local': 'communication.speech',
  'thought_internal': 'communication.thought',
  'notes_jotted': 'communication.notes',
  // ... complete mapping table
};

// Context-aware mappings for generic types
const CONTEXT_MAPPINGS = {
  'music': 'performance.music',
  'ballet': 'performance.dance',
  'gymnastics': 'performance.dance',
  'weapons': 'combat.attack',
  'ranged': 'combat.attack',
  'violence': 'combat.violence',
  'sex-': 'intimacy.sexual',  // prefix match
  'seduction': 'intimacy.sensual',
  'warding': 'magic.spell',
  'hexing': 'magic.spell',
  'affection': 'social.affection',
  'hugging': 'social.affection',
  'kissing': 'social.interaction',
  'caressing': 'social.interaction',
  'positioning': 'physical.target_action',
  'deference': 'physical.self_action',
  'recovery': 'physical.self_action',
};

function determineNewType(oldType, filePath) {
  // Direct mapping
  if (DIRECT_MAPPINGS[oldType]) {
    return DIRECT_MAPPINGS[oldType];
  }

  // Context-aware mapping for generic types
  if (oldType === 'action_self_general' || oldType === 'action_target_general') {
    const modFolder = extractModFolder(filePath);

    for (const [pattern, newType] of Object.entries(CONTEXT_MAPPINGS)) {
      if (modFolder.includes(pattern)) {
        // Adjust self vs target based on old type
        if (oldType === 'action_self_general' && newType.includes('target')) {
          return newType.replace('target', 'self');
        }
        return newType;
      }
    }

    // Default fallback
    return oldType === 'action_self_general'
      ? 'physical.self_action'
      : 'physical.target_action';
  }

  return null; // Unknown type
}

// Main migration logic
async function migrate(options = {}) {
  const { dryRun = false, reportOnly = false } = options;

  const report = {
    filesScanned: 0,
    filesModified: 0,
    typesChanged: {},
    errors: [],
  };

  // Find all JSON files in data/mods
  const modsDir = path.join(__dirname, '../data/mods');
  const files = findJsonFiles(modsDir, ['rules', 'macros']);

  for (const file of files) {
    report.filesScanned++;

    try {
      const content = fs.readFileSync(file, 'utf8');
      const json = JSON.parse(content);

      const { modified, changes } = processJson(json, file);

      if (modified) {
        report.filesModified++;

        for (const change of changes) {
          report.typesChanged[change.from] = report.typesChanged[change.from] || [];
          report.typesChanged[change.from].push({
            file,
            to: change.to,
          });
        }

        if (!dryRun && !reportOnly) {
          fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
        }
      }
    } catch (err) {
      report.errors.push({ file, error: err.message });
    }
  }

  return report;
}

// Entry point
const args = process.argv.slice(2);
migrate({
  dryRun: args.includes('--dry-run'),
  reportOnly: args.includes('--report'),
}).then(report => {
  console.log(JSON.stringify(report, null, 2));
});
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/perception/perceptionTypeRegistry.test.js`

```javascript
describe('perceptionTypeRegistry', () => {
  describe('isValidPerceptionType', () => {
    it('should accept new dotted types', () => {
      expect(isValidPerceptionType('communication.speech')).toBe(true);
    });

    it('should accept legacy types during transition', () => {
      expect(isValidPerceptionType('speech_local')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(isValidPerceptionType('invalid_type')).toBe(false);
    });
  });

  describe('getLegacyTypeMapping', () => {
    it('should map legacy types to new format', () => {
      expect(getLegacyTypeMapping('speech_local')).toBe('communication.speech');
    });

    it('should return null for new types', () => {
      expect(getLegacyTypeMapping('communication.speech')).toBeNull();
    });
  });

  describe('suggestNearestType', () => {
    it('should suggest similar types', () => {
      expect(suggestNearestType('comunication.speech')).toBe('communication.speech');
    });
  });
});
```

### Integration Tests

**File**: `tests/integration/perception/perceptionTypeTheming.integration.test.js`

```javascript
describe('Perception Log Theming', () => {
  it('should apply correct CSS class for speech type', () => {
    const logEntry = {
      descriptionText: 'Alice says: Hello',
      perceptionType: 'communication.speech'
    };
    const element = renderer._renderListItem(logEntry, 0, {});

    expect(element.classList.contains('log-type-speech')).toBe(true);
    expect(element.classList.contains('log-cat-communication')).toBe(true);
  });

  it('should handle legacy types gracefully', () => {
    const logEntry = {
      descriptionText: 'Alice says: Hello',
      perceptionType: 'speech_local'
    };
    const element = renderer._renderListItem(logEntry, 0, {});

    expect(element.classList.contains('log-type-speech')).toBe(true);
  });
});
```

## Implementation Order

1. **Create spec file** ✅ (this document)
2. **Create registry** (`perceptionTypeRegistry.js`) - non-breaking
3. **Create validator** (`perceptionTypeValidator.js`) - non-breaking
4. **Add CSS theming** - non-breaking, additive
5. **Update renderer** - backward compatible with legacy types
6. **Add handler validation** - with deprecation warnings
7. **Update schema** - add new types, mark legacy as deprecated
8. **Create migration script** - with dry-run support
9. **Run migration** - update all mod files
10. **Update tests** - add new, update existing
11. **Final cleanup** - remove legacy types from schema (future version)

## Backward Compatibility

During the transition period:
- Legacy types remain valid in schema
- Handler logs deprecation warnings but accepts legacy types
- Renderer maps legacy types to new CSS classes
- Migration script can run incrementally

## Success Criteria

1. All 46 legacy types map to one of 32 new types
2. Runtime validation catches invalid types with helpful suggestions
3. UI displays category-appropriate colors for all perception types
4. All existing mod files successfully migrate
5. No breaking changes during transition period
6. Test coverage > 80% for new code
