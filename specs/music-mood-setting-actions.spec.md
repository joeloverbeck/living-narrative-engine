# Music Mood-Setting Actions Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-05
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines a series of actions and rules for the `music` mod that allow trained musicians to set the emotional mood of a musical performance on an instrument. The feature introduces 10 distinct mood-setting actions that initialize or modify the performance state with specific emotional tones.

### 1.2 Motivation

Building on the music mod's component infrastructure (defined in `specs/music-mod.spec.md`), this feature provides the actual gameplay mechanics for musicians to express emotional intent through their performances. The mood-setting actions serve dual purposes:

1. **Initialize Performance**: If the actor is not currently playing, these actions start the performance with the specified mood
2. **Change Mood**: If already playing, these actions transition the performance to a new emotional tone

### 1.3 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides `items:examinable_items` scope and item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component

### 1.4 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `docs/mods/mod-color-schemes.md` - Visual identity for music mod

## 2. Mood Taxonomy

The following 10 moods are supported, each with distinct descriptive language:

| Mood | Adjective | Adjectives (Variations) | Noun |
|------|-----------|------------------------|------|
| **cheerful** | bright | bright, skipping | bouncy |
| **solemn** | grave | measured, weighty | grave |
| **mournful** | aching | low, aching | woeful |
| **eerie** | unsettling | thin, uneasy | hollow |
| **tense** | tight | insistent, tight | tight |
| **triumphant** | bold | ringing, bold | bold |
| **tender** | soft | soft, warm | delicate |
| **playful** | teasing | quick, teasing | skipping |
| **aggressive** | hard-edged | driving, sharp | hard-driving |
| **meditative** | calm | slow, even | steady |

## 3. Lookup File Definition

### 3.1 File Structure

**File**: `data/mods/music/lookups/mood_lexicon.lookup.json`

```json
{
  "$schema": "schema://living-narrative-engine/lookup.schema.json",
  "id": "music:mood_lexicon",
  "description": "Maps musical mood names to descriptive adjectives and nouns for performance narrative generation",
  "dataSchema": {
    "type": "object",
    "properties": {
      "adj": {
        "type": "string",
        "description": "Primary adjective describing the mood"
      },
      "adjectives": {
        "type": "string",
        "description": "Comma-separated list of adjectives for variety"
      },
      "noun": {
        "type": "string",
        "description": "Noun form of the mood descriptor"
      }
    },
    "required": ["adj", "adjectives", "noun"],
    "additionalProperties": false
  },
  "entries": {
    "cheerful": {
      "adj": "bright",
      "adjectives": "bright, skipping",
      "noun": "bouncy"
    },
    "solemn": {
      "adj": "grave",
      "adjectives": "measured, weighty",
      "noun": "grave"
    },
    "mournful": {
      "adj": "aching",
      "adjectives": "low, aching",
      "noun": "woeful"
    },
    "eerie": {
      "adj": "unsettling",
      "adjectives": "thin, uneasy",
      "noun": "hollow"
    },
    "tense": {
      "adj": "tight",
      "adjectives": "insistent, tight",
      "noun": "tight"
    },
    "triumphant": {
      "adj": "bold",
      "adjectives": "ringing, bold",
      "noun": "bold"
    },
    "tender": {
      "adj": "soft",
      "adjectives": "soft, warm",
      "noun": "delicate"
    },
    "playful": {
      "adj": "teasing",
      "adjectives": "quick, teasing",
      "noun": "skipping"
    },
    "aggressive": {
      "adj": "hard-edged",
      "adjectives": "driving, sharp",
      "noun": "hard-driving"
    },
    "meditative": {
      "adj": "calm",
      "adjectives": "slow, even",
      "noun": "steady"
    }
  }
}
```

### 3.2 Lookup Loading

The lookup file must be registered in the music mod manifest:

**File**: `data/mods/music/mod-manifest.json` (update)

```json
{
  "content": {
    "components": [...],
    "actions": [...],
    "rules": [...],
    "conditions": [...],
    "scopes": [],
    "lookups": [
      "mood_lexicon.lookup.json"
    ]
  }
}
```

**Note**: This requires the lookups content type infrastructure to be implemented per `specs/lookups-content-type-infrastructure.spec.md`.

## 4. Action Definitions

All 10 actions follow a consistent structure pattern. The actions use the `items:examinable_items` scope which includes all items in the actor's inventory plus all items at the actor's location (regardless of portability).

### 4.1 Action Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:set_{mood}_mood_on_instrument",
  "name": "Set {Mood} Mood on Instrument",
  "description": "Play an instrument with a {mood} emotional tone, or transition an ongoing performance to a {mood} mood.",
  "targets": {
    "primary": {
      "scope": "items:examinable_items",
      "placeholder": "instrument",
      "description": "Instrument to play with {mood} mood"
    }
  },
  "required_components": {
    "actor": ["music:is_musician"],
    "primary": ["items:item", "music:is_instrument"]
  },
  "prerequisites": [],
  "template": "set {mood} mood on {instrument}",
  "visual": {
    "backgroundColor": "#1a2332",
    "textColor": "#d1d5db",
    "hoverBackgroundColor": "#2d3748",
    "hoverTextColor": "#f3f4f6"
  }
}
```

### 4.2 Individual Action Files

Create the following action files in `data/mods/music/actions/`:

1. `set_cheerful_mood_on_instrument.action.json`
2. `set_solemn_mood_on_instrument.action.json`
3. `set_mournful_mood_on_instrument.action.json`
4. `set_eerie_mood_on_instrument.action.json`
5. `set_tense_mood_on_instrument.action.json`
6. `set_triumphant_mood_on_instrument.action.json`
7. `set_tender_mood_on_instrument.action.json`
8. `set_playful_mood_on_instrument.action.json`
9. `set_aggressive_mood_on_instrument.action.json`
10. `set_meditative_mood_on_instrument.action.json`

Each file replaces `{mood}` with the specific mood value in:
- The `id` field
- The `name` field
- The `description` field
- The `template` field

**Visual Identity**: All actions use the Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with the music mod's visual identity.

## 5. Rule Definitions

All 10 rules follow a consistent structure pattern. Each rule handles the corresponding mood-setting action.

### 5.1 Rule Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_set_{mood}_mood_on_instrument",
  "comment": "Handles setting {mood} mood on an instrument, initializing performance if needed.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-set-{mood}-mood-on-instrument"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Capture the actor name",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Capture the instrument name",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "instrumentName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for contextual logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "QUERY_LOOKUP",
      "comment": "Retrieve mood descriptors from lexicon",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adj": "{mood}" }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Mark actor as playing the instrument",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "music:playing_music",
        "component_data": {
          "playing_on": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Set the performance mood",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "music:performance_mood",
        "component_data": {
          "mood": "{mood}"
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Mark actor as engaged in complex performance",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:doing_complex_performance",
        "component_data": {}
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "comment": "Announce the mood-setting to observers",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} sets a {context.moodDescriptor.adj} tone on the {context.instrumentName}.",
        "perception_type": "music_mood_set",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}",
        "contextual_data": {
          "mood": "{mood}",
          "instrumentId": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare success message for UI",
      "parameters": {
        "variable_name": "successMessage",
        "value": "{context.actorName} sets a {context.moodDescriptor.adj} tone on the {context.instrumentName}."
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Display success message",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": {
          "message": "{context.successMessage}"
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End the actor's turn on success",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

### 5.2 Individual Rule Files

Create the following rule files in `data/mods/music/rules/`:

1. `handle_set_cheerful_mood_on_instrument.rule.json`
2. `handle_set_solemn_mood_on_instrument.rule.json`
3. `handle_set_mournful_mood_on_instrument.rule.json`
4. `handle_set_eerie_mood_on_instrument.rule.json`
5. `handle_set_tense_mood_on_instrument.rule.json`
6. `handle_set_triumphant_mood_on_instrument.rule.json`
7. `handle_set_tender_mood_on_instrument.rule.json`
8. `handle_set_playful_mood_on_instrument.rule.json`
9. `handle_set_aggressive_mood_on_instrument.rule.json`
10. `handle_set_meditative_mood_on_instrument.rule.json`

Each file replaces `{mood}` with the specific mood value throughout the template.

## 6. Condition Definitions

Each action requires a corresponding condition file to detect the action attempt event.

### 6.1 Condition Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-set-{mood}-mood-on-instrument",
  "description": "Evaluates to true when the event is an attempt to set {mood} mood on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:set_{mood}_mood_on_instrument"
    ]
  }
}
```

### 6.2 Individual Condition Files

Create the following condition files in `data/mods/music/conditions/`:

1. `event-is-action-set-cheerful-mood-on-instrument.condition.json`
2. `event-is-action-set-solemn-mood-on-instrument.condition.json`
3. `event-is-action-set-mournful-mood-on-instrument.condition.json`
4. `event-is-action-set-eerie-mood-on-instrument.condition.json`
5. `event-is-action-set-tense-mood-on-instrument.condition.json`
6. `event-is-action-set-triumphant-mood-on-instrument.condition.json`
7. `event-is-action-set-tender-mood-on-instrument.condition.json`
8. `event-is-action-set-playful-mood-on-instrument.condition.json`
9. `event-is-action-set-aggressive-mood-on-instrument.condition.json`
10. `event-is-action-set-meditative-mood-on-instrument.condition.json`

**Note**: Condition files use **hyphens** in the filename, per the mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 7. Operation Handler: QUERY_LOOKUP

### 7.1 Need Assessment

The rules require access to the `music:mood_lexicon` lookup data at runtime to compose narrative messages. While existing operation handlers can query components and set variables, none can access lookup data from the data registry.

**Recommendation**: Create a new `QUERY_LOOKUP` operation handler to enable rules to access lookup table entries.

### 7.2 Operation Handler Specification

**File**: `src/logic/operationHandlers/queryLookupHandler.js`

#### 7.2.1 Interface

```javascript
/**
 * @typedef {object} QueryLookupOperationParams
 * @property {string} lookup_id - Namespaced ID of the lookup table (e.g., "music:mood_lexicon")
 * @property {string} entry_key - Key to retrieve from the lookup's entries object
 * @property {string} result_variable - Variable name to store the result in executionContext.evaluationContext.context
 * @property {*} [missing_value] - Optional value to return if lookup or entry is missing (defaults to undefined)
 */
```

#### 7.2.2 Behavior

1. **Lookup Resolution**: Retrieve the lookup table from the data registry using `lookup_id`
2. **Entry Access**: Access the specified `entry_key` from the lookup's `entries` object
3. **Context Storage**: Store the result in the execution context at `context[result_variable]`
4. **Missing Handling**: If lookup or entry is missing, store `missing_value` (or `undefined` if not provided)
5. **Error Handling**: Dispatch error events for invalid parameters or lookup resolution failures

#### 7.2.3 Usage Example

```json
{
  "type": "QUERY_LOOKUP",
  "parameters": {
    "lookup_id": "music:mood_lexicon",
    "entry_key": "triumphant",
    "result_variable": "moodDescriptor",
    "missing_value": { "adj": "neutral" }
  }
}
```

Result stored in context:
```javascript
context.moodDescriptor = {
  adj: "bold",
  adjectives: "ringing, bold",
  noun: "bold"
}
```

#### 7.2.4 Implementation Requirements

- Extend `BaseOperationHandler` or `ComponentOperationHandler`
- Inject `IDataRegistry` dependency for lookup access
- Support template interpolation in `entry_key` parameter
- Include comprehensive error messages for debugging
- Follow existing handler patterns in `src/logic/operationHandlers/`

#### 7.2.5 Registration

**File**: `src/dependencyInjection/registrations/operationHandlersRegistrations.js` (update)

1. Import the new handler
2. Register it in the operation handlers registry
3. Map the operation type name `"QUERY_LOOKUP"` to the handler class

## 8. Testing Strategy

Comprehensive automated testing is required for all 10 mood-setting actions.

### 8.1 Test File Organization

Create test files in `tests/integration/mods/music/`:

**Action Discovery Tests** (1 file per action):
- `set_cheerful_mood_on_instrument_action_discovery.test.js`
- `set_solemn_mood_on_instrument_action_discovery.test.js`
- `set_mournful_mood_on_instrument_action_discovery.test.js`
- `set_eerie_mood_on_instrument_action_discovery.test.js`
- `set_tense_mood_on_instrument_action_discovery.test.js`
- `set_triumphant_mood_on_instrument_action_discovery.test.js`
- `set_tender_mood_on_instrument_action_discovery.test.js`
- `set_playful_mood_on_instrument_action_discovery.test.js`
- `set_aggressive_mood_on_instrument_action_discovery.test.js`
- `set_meditative_mood_on_instrument_action_discovery.test.js`

**Rule Execution Tests** (1 file per action):
- `set_cheerful_mood_on_instrument_rule_execution.test.js`
- `set_solemn_mood_on_instrument_rule_execution.test.js`
- (... same pattern for remaining moods)

### 8.2 Action Discovery Test Template

```javascript
/**
 * @file Integration tests for the music:set_{mood}_mood_on_instrument action definition.
 * @description Tests that the action is properly defined and discoverable for musicians with instruments.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder, ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

describe('music:set_{mood}_mood_on_instrument action definition', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('music', 'music:set_{mood}_mood_on_instrument');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    const action = testFixture.action;
    expect(action).toBeDefined();
    expect(action.id).toBe('music:set_{mood}_mood_on_instrument');
    expect(action.name).toBe('Set {Mood} Mood on Instrument');
    expect(action.template).toBe('set {mood} mood on {instrument}');
  });

  it('should use examinable_items scope for primary targets', () => {
    const action = testFixture.action;
    expect(action.targets.primary.scope).toBe('items:examinable_items');
    expect(action.targets.primary.placeholder).toBe('instrument');
  });

  it('should require is_musician component on actor', () => {
    const action = testFixture.action;
    expect(action.required_components.actor).toContain('music:is_musician');
  });

  it('should require item and is_instrument components on primary target', () => {
    const action = testFixture.action;
    expect(action.required_components.primary).toEqual([
      'items:item',
      'music:is_instrument'
    ]);
  });

  describe('Action discovery behavior', () => {
    it('should appear when musician has instrument in inventory', () => {
      const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Performer')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('items:inventory', {
          items: ['lute1'],
          capacity: { maxWeight: 50, maxItems: 10 }
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('Fine Lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      const availableActions = testFixture.testEnv.getAvailableActions('musician1');
      const moodActions = availableActions.filter(
        (action) => action.id === 'music:set_{mood}_mood_on_instrument'
      );

      expect(moodActions.length).toBeGreaterThan(0);
    });

    it('should appear when instrument is at actor location', () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Performer')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('Grand Piano')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      const availableActions = testFixture.testEnv.getAvailableActions('musician1');
      const moodActions = availableActions.filter(
        (action) => action.id === 'music:set_{mood}_mood_on_instrument'
      );

      expect(moodActions.length).toBeGreaterThan(0);
    });

    it('should not appear when actor lacks is_musician component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const nonMusician = new ModEntityBuilder('actor1')
        .withName('Non-Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['lute1'],
          capacity: { maxWeight: 50, maxItems: 10 }
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('Lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const moodActions = availableActions.filter(
        (action) => action.id === 'music:set_{mood}_mood_on_instrument'
      );

      expect(moodActions.length).toBe(0);
    });

    it('should not appear when item lacks is_instrument component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('items:inventory', {
          items: ['book1'],
          capacity: { maxWeight: 50, maxItems: 10 }
        })
        .build();

      const nonInstrument = new ModEntityBuilder('book1')
        .withName('Book')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, musician, nonInstrument]);

      const availableActions = testFixture.testEnv.getAvailableActions('musician1');
      const moodActions = availableActions.filter(
        (action) => action.id === 'music:set_{mood}_mood_on_instrument'
      );

      expect(moodActions.length).toBe(0);
    });
  });
});
```

### 8.3 Rule Execution Test Template

```javascript
/**
 * @file Integration tests for the music:set_{mood}_mood_on_instrument rule.
 * @description Verifies rule execution for setting {mood} mood on instruments.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder, ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';

describe('music:set_{mood}_mood_on_instrument rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:set_{mood}_mood_on_instrument'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should initialize performance with {mood} mood when not playing', async () => {
    const room = ModEntityScenarios.createRoom('hall', 'Hall');

    const musician = new ModEntityBuilder('musician1')
      .withName('Bard')
      .atLocation('hall')
      .asActor()
      .withComponent('music:is_musician', {})
      .withComponent('items:inventory', {
        items: ['lute1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    const instrument = new ModEntityBuilder('lute1')
      .withName('Lute')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('music:is_instrument', {})
      .build();

    testFixture.reset([room, musician, instrument]);

    await testFixture.executeAction('musician1', 'lute1');

    // Verify playing_music component
    const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
    expect(musicianAfter).toHaveComponent('music:playing_music');
    const playingData = musicianAfter.getComponentData('music:playing_music');
    expect(playingData.playing_on).toBe('lute1');

    // Verify performance_mood component
    expect(musicianAfter).toHaveComponent('music:performance_mood');
    const moodData = musicianAfter.getComponentData('music:performance_mood');
    expect(moodData.mood).toBe('{mood}');

    // Verify doing_complex_performance component
    expect(musicianAfter).toHaveComponent('positioning:doing_complex_performance');

    // Verify perceptible event
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event' &&
                 event.payload.perceptionType === 'music_mood_set'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Bard sets a');
    expect(perceptibleEvent.payload.descriptionText).toContain('tone on the Lute');
    expect(perceptibleEvent.payload.contextualData.mood).toBe('{mood}');

    // Verify success
    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('should change mood when already playing same instrument', async () => {
    const room = ModEntityScenarios.createRoom('hall', 'Hall');

    const musician = new ModEntityBuilder('musician1')
      .withName('Bard')
      .atLocation('hall')
      .asActor()
      .withComponent('music:is_musician', {})
      .withComponent('music:playing_music', {
        playing_on: 'lute1'
      })
      .withComponent('music:performance_mood', {
        mood: 'cheerful'
      })
      .withComponent('positioning:doing_complex_performance', {})
      .withComponent('items:inventory', {
        items: ['lute1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    const instrument = new ModEntityBuilder('lute1')
      .withName('Lute')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('music:is_instrument', {})
      .build();

    testFixture.reset([room, musician, instrument]);

    await testFixture.executeAction('musician1', 'lute1');

    const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
    const moodData = musicianAfter.getComponentData('music:performance_mood');
    expect(moodData.mood).toBe('{mood}');
  });

  it('should use mood descriptor from lexicon in message', async () => {
    const room = ModEntityScenarios.createRoom('hall', 'Hall');

    const musician = new ModEntityBuilder('musician1')
      .withName('Performer')
      .atLocation('hall')
      .asActor()
      .withComponent('music:is_musician', {})
      .withComponent('items:inventory', {
        items: ['harp1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    const instrument = new ModEntityBuilder('harp1')
      .withName('Golden Harp')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('music:is_instrument', {})
      .build();

    testFixture.reset([room, musician, instrument]);

    await testFixture.executeAction('musician1', 'harp1');

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Verify the adjective from the lexicon is used
    const expectedAdj = '{expected_adjective}'; // Replace with actual adjective from lookup
    expect(perceptibleEvent.payload.descriptionText).toContain(expectedAdj);
  });
});
```

### 8.4 Unit Tests for QUERY_LOOKUP Handler

**File**: `tests/unit/logic/operationHandlers/queryLookupHandler.test.js`

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import QueryLookupHandler from '../../../../src/logic/operationHandlers/queryLookupHandler.js';

describe('QueryLookupHandler', () => {
  let testBed;
  let handler;

  beforeEach(() => {
    testBed = createTestBed();

    // Mock data registry with sample lookup
    const mockRegistry = {
      getById: jest.fn((id, contentType) => {
        if (id === 'test:sample_lookup' && contentType === 'lookups') {
          return {
            id: 'test:sample_lookup',
            entries: {
              key1: { value: 'data1' },
              key2: { value: 'data2' }
            }
          };
        }
        return null;
      })
    };

    handler = new QueryLookupHandler({
      dataRegistry: mockRegistry,
      logger: testBed.createMockLogger(),
      safeEventDispatcher: testBed.createMock('dispatcher', ['dispatch'])
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should retrieve lookup entry and store in context', async () => {
    const params = {
      lookup_id: 'test:sample_lookup',
      entry_key: 'key1',
      result_variable: 'myResult'
    };

    const executionContext = {
      evaluationContext: {
        context: {}
      }
    };

    await handler.execute(params, executionContext);

    expect(executionContext.evaluationContext.context.myResult).toEqual({
      value: 'data1'
    });
  });

  it('should use missing_value when lookup not found', async () => {
    const params = {
      lookup_id: 'test:nonexistent',
      entry_key: 'key1',
      result_variable: 'myResult',
      missing_value: { default: true }
    };

    const executionContext = {
      evaluationContext: {
        context: {}
      }
    };

    await handler.execute(params, executionContext);

    expect(executionContext.evaluationContext.context.myResult).toEqual({
      default: true
    });
  });

  it('should use missing_value when entry key not found', async () => {
    const params = {
      lookup_id: 'test:sample_lookup',
      entry_key: 'nonexistent_key',
      result_variable: 'myResult',
      missing_value: { default: true }
    };

    const executionContext = {
      evaluationContext: {
        context: {}
      }
    };

    await handler.execute(params, executionContext);

    expect(executionContext.evaluationContext.context.myResult).toEqual({
      default: true
    });
  });
});
```

### 8.5 Integration Test for Lookup Loading

**File**: `tests/integration/mods/music/moodLexiconLoading.integration.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { createTestWorld } from '../../../common/testWorld.js';

describe('Music mood lexicon loading', () => {
  it('should load mood_lexicon.lookup.json during mod initialization', async () => {
    const world = await createTestWorld(['core', 'items', 'positioning', 'music']);

    const lookup = world.dataRegistry.getById('music:mood_lexicon', 'lookups');

    expect(lookup).toBeDefined();
    expect(lookup.id).toBe('music:mood_lexicon');
    expect(lookup.entries).toBeDefined();
    expect(lookup.entries.cheerful).toEqual({
      adj: 'bright',
      adjectives: 'bright, skipping',
      noun: 'bouncy'
    });
    expect(lookup.entries.solemn).toBeDefined();
    expect(lookup.entries.triumphant).toBeDefined();
  });

  it('should have all 10 mood entries', async () => {
    const world = await createTestWorld(['core', 'items', 'positioning', 'music']);

    const lookup = world.dataRegistry.getById('music:mood_lexicon', 'lookups');

    const expectedMoods = [
      'cheerful', 'solemn', 'mournful', 'eerie', 'tense',
      'triumphant', 'tender', 'playful', 'aggressive', 'meditative'
    ];

    for (const mood of expectedMoods) {
      expect(lookup.entries[mood]).toBeDefined();
      expect(lookup.entries[mood].adj).toBeDefined();
      expect(lookup.entries[mood].adjectives).toBeDefined();
      expect(lookup.entries[mood].noun).toBeDefined();
    }
  });
});
```

### 8.6 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for each action's discovery logic
- **Rule Execution**: ≥80% coverage for each rule's operation sequence
- **QUERY_LOOKUP Handler**: ≥90% coverage (critical infrastructure)
- **Integration**: Full workflow tests for at least 3 representative moods

## 9. File Structure Summary

```
data/mods/music/
├── lookups/
│   └── mood_lexicon.lookup.json                          [NEW]
├── actions/
│   ├── set_cheerful_mood_on_instrument.action.json       [NEW]
│   ├── set_solemn_mood_on_instrument.action.json         [NEW]
│   ├── set_mournful_mood_on_instrument.action.json       [NEW]
│   ├── set_eerie_mood_on_instrument.action.json          [NEW]
│   ├── set_tense_mood_on_instrument.action.json          [NEW]
│   ├── set_triumphant_mood_on_instrument.action.json     [NEW]
│   ├── set_tender_mood_on_instrument.action.json         [NEW]
│   ├── set_playful_mood_on_instrument.action.json        [NEW]
│   ├── set_aggressive_mood_on_instrument.action.json     [NEW]
│   └── set_meditative_mood_on_instrument.action.json     [NEW]
├── rules/
│   ├── handle_set_cheerful_mood_on_instrument.rule.json  [NEW]
│   ├── handle_set_solemn_mood_on_instrument.rule.json    [NEW]
│   └── (... 8 more rule files)                           [NEW]
├── conditions/
│   ├── event-is-action-set-cheerful-mood-on-instrument.condition.json  [NEW]
│   ├── event-is-action-set-solemn-mood-on-instrument.condition.json    [NEW]
│   └── (... 8 more condition files)                                    [NEW]
└── mod-manifest.json                                     [UPDATE]

src/logic/operationHandlers/
└── queryLookupHandler.js                                 [NEW]

src/dependencyInjection/registrations/
└── operationHandlersRegistrations.js                     [UPDATE]

tests/integration/mods/music/
├── set_cheerful_mood_on_instrument_action_discovery.test.js  [NEW]
├── set_cheerful_mood_on_instrument_rule_execution.test.js    [NEW]
├── (... 18 more test files for other moods)                  [NEW]
└── moodLexiconLoading.integration.test.js                    [NEW]

tests/unit/logic/operationHandlers/
└── queryLookupHandler.test.js                            [NEW]
```

## 10. Implementation Checklist

### 10.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify lookups content type infrastructure is implemented (per `specs/lookups-content-type-infrastructure.spec.md`)
- [ ] Verify `items:examinable_items` scope exists and functions correctly

### 10.2 Lookup System

- [ ] Create `data/mods/music/lookups/mood_lexicon.lookup.json`
- [ ] Update `data/mods/music/mod-manifest.json` to include lookup file
- [ ] Verify lookup loads correctly during mod initialization

### 10.3 Operation Handler

- [ ] Create `src/logic/operationHandlers/queryLookupHandler.js`
- [ ] Update `src/dependencyInjection/registrations/operationHandlersRegistrations.js`
- [ ] Create unit tests for handler: `tests/unit/logic/operationHandlers/queryLookupHandler.test.js`
- [ ] Run tests: `NODE_ENV=test npm run test:unit -- tests/unit/logic/operationHandlers/queryLookupHandler.test.js`

### 10.4 Action Definitions

- [ ] Create all 10 action files in `data/mods/music/actions/`
- [ ] Verify each action uses Starlight Navy visual scheme
- [ ] Update mod manifest to include action files

### 10.5 Rule Definitions

- [ ] Create all 10 rule files in `data/mods/music/rules/`
- [ ] Update mod manifest to include rule files

### 10.6 Condition Definitions

- [ ] Create all 10 condition files in `data/mods/music/conditions/`
- [ ] Verify condition files use hyphens (not underscores) in filenames
- [ ] Update mod manifest to include condition files

### 10.7 Testing

**Action Discovery Tests**:
- [ ] Create action discovery test for cheerful mood
- [ ] Create action discovery test for solemn mood
- [ ] Create action discovery test for mournful mood
- [ ] Create action discovery test for eerie mood
- [ ] Create action discovery test for tense mood
- [ ] Create action discovery test for triumphant mood
- [ ] Create action discovery test for tender mood
- [ ] Create action discovery test for playful mood
- [ ] Create action discovery test for aggressive mood
- [ ] Create action discovery test for meditative mood

**Rule Execution Tests**:
- [ ] Create rule execution test for cheerful mood
- [ ] Create rule execution test for solemn mood
- [ ] Create rule execution test for mournful mood
- [ ] Create rule execution test for eerie mood
- [ ] Create rule execution test for tense mood
- [ ] Create rule execution test for triumphant mood
- [ ] Create rule execution test for tender mood
- [ ] Create rule execution test for playful mood
- [ ] Create rule execution test for aggressive mood
- [ ] Create rule execution test for meditative mood

**Integration Tests**:
- [ ] Create lookup loading integration test
- [ ] Run all tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`

### 10.8 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint src/logic/operationHandlers/queryLookupHandler.js`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds

### 10.9 Documentation

- [ ] Update `CLAUDE.md` if new patterns introduced
- [ ] Document QUERY_LOOKUP operation in relevant guides
- [ ] Add example usage to operation handler documentation

## 11. Acceptance Criteria

1. ✅ All 10 mood-setting actions are defined and load correctly
2. ✅ All 10 rules are defined and execute correctly
3. ✅ `music:mood_lexicon` lookup file loads during mod initialization
4. ✅ QUERY_LOOKUP operation handler retrieves lookup data correctly
5. ✅ Actions are discoverable for musicians with instruments
6. ✅ Rules add/update `playing_music` and `performance_mood` components
7. ✅ Rules add `positioning:doing_complex_performance` component
8. ✅ Perceptible events use mood descriptors from lexicon
9. ✅ Success messages are displayed correctly
10. ✅ All action discovery tests pass
11. ✅ All rule execution tests pass
12. ✅ Test coverage meets 80%+ thresholds
13. ✅ No schema validation errors
14. ✅ No linting errors
15. ✅ No type checking errors

## 12. Design Decisions

### 12.1 Why Separate Actions Instead of Parameters?

**Decision**: Create 10 distinct actions rather than one parameterized action.

**Rationale**:
- **Discoverability**: Each mood appears as a separate, immediately understandable command
- **UI Clarity**: Players see "set cheerful mood on lute" vs. complex parameter selection
- **Consistency**: Follows engine patterns where actions are atomic, discoverable units
- **Simplicity**: Avoids parameter selection UI complexity

### 12.2 Why QUERY_LOOKUP Instead of Hardcoded Strings?

**Decision**: Use a lookup table with a dedicated operation handler.

**Rationale**:
- **Moddability**: Modders can override mood descriptors without editing rule files
- **Consistency**: Maintains single source of truth for mood language
- **Future-Proofing**: Establishes pattern for other lookup-driven narrative systems
- **Localization**: Enables future translation support

### 12.3 Why Use items:examinable_items Scope?

**Decision**: Use the existing `items:examinable_items` scope rather than creating a music-specific scope.

**Rationale**:
- **Reusability**: Leverages existing, well-tested scope logic
- **Consistency**: Matches pattern used by other item interaction actions (examine, read)
- **Flexibility**: Supports both portable instruments (in inventory) and stationary instruments (at location)

## 13. Future Enhancements

### 13.1 Dynamic Mood Selection UI

Add a specialized UI element for mood selection with:
- Visual mood palette
- Audio previews
- Mood descriptions and effects

### 13.2 Mood Transitions

Support smooth mood transitions with:
- Transition difficulty/cost
- Gradual mood blending
- Audience reaction to transitions

### 13.3 Skill-Based Mood Execution

Tie mood expression quality to musician skill:
- Performance quality checks
- Failed mood attempts
- Expertise-based mood unlocking

### 13.4 Ensemble Mood Synchronization

Enable multiple musicians to coordinate moods:
- Mood conflict detection
- Harmony bonuses
- Leader/follower dynamics

## 14. References

### 14.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system
- `docs/mods/mod-color-schemes.md` - Visual identity

### 14.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview

### 14.3 Reference Action/Rule

- `data/mods/items/actions/read_item.action.json` - Action structure reference
- `data/mods/items/rules/handle_read_item.rule.json` - Rule structure reference
- `tests/integration/mods/items/readItemActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/items/readItemRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-05
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding mood-setting actions to the Living Narrative Engine music mod. The design prioritizes consistency with existing patterns, comprehensive testing, and future extensibility._
