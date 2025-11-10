# Play Drone on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-06
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to perform a **drone** - a sustained, continuous tone or harmonic - on the instrument they are currently playing. Unlike the ostinato and phrase-playing actions, this action is restricted to specific performance moods that are compatible with drone as a musical archetype.

### 1.2 Motivation

Building on the music mod actions defined in `specs/play-ostinato-on-instrument-action.spec.md` and `specs/play-phrase-on-instrument-action.spec.md`, this feature provides:

1. **Musical Archetype Specificity**: Drone is a distinct musical technique requiring specific atmospheric moods
2. **Mood-Based Gameplay Constraints**: Not all moods support sustained drone tones (e.g., cheerful, aggressive, playful, triumphant are incompatible)
3. **Expressive Depth**: Provides a specialized musical technique for sustained, atmospheric performances
4. **Prerequisite Pattern Consistency**: Follows established pattern for component property validation

### 1.3 Musical Context: Drone

A **drone** is a sustained tone or harmonic that persists throughout a musical passage. It is characterized by:

- **Sustained Tone**: Continuous, unchanging pitch held throughout performance
- **Atmospheric Quality**: Creates contemplative, haunting, or meditative sonic environments
- **Mood Compatibility**: Works best with introspective, solemn, or unsettling moods
- **Incompatibility**: Doesn't work well with upbeat, energetic, or celebratory moods

**Compatible Moods**: eerie, solemn, meditative, mournful
**Incompatible Moods**: cheerful, aggressive, playful, tense, triumphant, tender

### 1.4 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component (optional)

### 1.5 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/play-ostinato-on-instrument-action.spec.md` - Similar prerequisite-based musical action
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `docs/mods/mod-color-schemes.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/play_drone_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:play_drone_on_instrument",
  "name": "Play Drone on Instrument",
  "description": "Hold a sustained, continuous tone (drone) on the instrument you are currently playing. This technique works best with contemplative, atmospheric, or solemn moods.",
  "targets": {
    "primary": {
      "scope": "music:instrument_actor_is_playing",
      "placeholder": "instrument",
      "description": "The instrument you are currently playing"
    }
  },
  "required_components": {
    "actor": [
      "music:is_musician",
      "music:playing_music",
      "music:performance_mood"
    ],
    "primary": [
      "items:item",
      "music:is_instrument"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "in": [
          {
            "var": "actor.components.music:performance_mood.mood"
          },
          ["eerie", "solemn", "meditative", "mournful"]
        ]
      },
      "failure_message": "Sustained drones don't work well with your current performance mood. Try a mood that's more contemplative, atmospheric, or solemn."
    }
  ],
  "template": "play drone on {instrument}",
  "visual": {
    "backgroundColor": "#1a2332",
    "textColor": "#d1d5db",
    "hoverBackgroundColor": "#2d3748",
    "hoverTextColor": "#f3f4f6"
  }
}
```

### 2.2 Key Design Decisions

**Primary Target Scope**: Uses the existing `music:instrument_actor_is_playing` scope to ensure:
- Only the currently-played instrument appears as a valid target
- Actor cannot attempt drone on instruments they're not currently playing
- Scope resolution fails gracefully if actor stops playing

**Required Components**: Identical to `play_ostinato_on_instrument` and `play_phrase_on_instrument`:
- **Actor Requirements**:
  - `music:is_musician` - Must be a trained musician
  - `music:playing_music` - Must be actively playing an instrument
  - `music:performance_mood` - Must have an established performance mood
- **Primary Requirements**:
  - `items:item` - Target must be a valid item entity
  - `music:is_instrument` - Target must be a recognized instrument

**Prerequisites**: JSON Logic validation checking mood compatibility:
- Uses `in` operator to check if `performance_mood.mood` is in the compatible list
- Compatible moods: `eerie`, `solemn`, `meditative`, `mournful`
- Provides player-friendly failure message when mood is incompatible

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

### 2.3 Prerequisite Logic Explanation

The prerequisite validates that the actor's current performance mood is compatible with drone:

```json
{
  "in": [
    {"var": "actor.components.music:performance_mood.mood"},
    ["eerie", "solemn", "meditative", "mournful"]
  ]
}
```

This JSON Logic expression:
1. Retrieves the `mood` property from the actor's `music:performance_mood` component
2. Checks if the mood value is present in the array of compatible moods
3. Returns `true` if compatible, `false` if incompatible
4. If `false`, the action is filtered out during discovery and the failure message is logged

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-play-drone-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-play-drone-on-instrument",
  "description": "Evaluates to true when the event is an attempt to play a drone on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:play_drone_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_play_drone_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_play_drone_on_instrument",
  "comment": "Handles playing a drone (sustained tone) on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-play-drone-on-instrument"
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
        "entity_ref": "primary",
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
      "type": "QUERY_COMPONENT",
      "comment": "Retrieve current performance mood",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "music:performance_mood",
        "result_variable": "performanceMood"
      }
    },
    {
      "type": "QUERY_LOOKUP",
      "comment": "Retrieve mood descriptors from lexicon, specifically the adjective form for drone message",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adj": "resonant" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} holds a {context.moodDescriptor.adj} drone on the {context.instrumentName}."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set perception type for event categorization",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Capture location for event dispatch",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Capture target ID for event dispatch",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.primaryId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### 4.2 Rule Operation Flow

1. **Name Resolution**: Capture actor and instrument names for message composition
2. **Position Query**: Retrieve actor location for perceptible event dispatch
3. **Mood Query**: Extract current `performance_mood.mood` value from actor
4. **Lexicon Lookup**: Retrieve mood **adjective** from `music:mood_lexicon` using the current mood as key
5. **Message Composition**: Build perceptible event message using format: `{actor} holds a {mood_adjective} drone on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Examples

Based on compatible performance moods (using `adj` field from mood_lexicon):

| Mood | Adjective | Message |
|------|-----------|---------|
| **eerie** | unsettling | "Kael holds an unsettling drone on the theremin." |
| **solemn** | grave | "Lyra holds a grave drone on the church organ." |
| **meditative** | calm | "Zara holds a calm drone on the singing bowl." |
| **mournful** | aching | "Marcus holds an aching drone on the cello." |

**Note**: The following moods are **not compatible** and will cause the action to be filtered during discovery:
- cheerful (bright)
- aggressive (hard-edged)
- playful (teasing)
- tense (tight)
- triumphant (bold)
- tender (soft)

## 5. Mod Manifest Update

**File**: `data/mods/music/mod-manifest.json` (update)

Add the following entries to the appropriate sections:

```json
{
  "content": {
    "actions": [
      "play_drone_on_instrument.action.json"
    ],
    "rules": [
      "handle_play_drone_on_instrument.rule.json"
    ],
    "conditions": [
      "event-is-action-play-drone-on-instrument.condition.json"
    ]
  }
}
```

**Note**: The `instrument_actor_is_playing.scope` already exists from previous music actions, so no scope updates are needed.

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/playDroneOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/playDroneOnInstrumentRuleExecution.test.js`

### 6.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/playDroneOnInstrumentActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for music:play_drone_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playDroneAction from '../../../../data/mods/music/actions/play_drone_on_instrument.action.json' assert { type: 'json' };

describe('music:play_drone_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_drone_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(playDroneAction).toBeDefined();
      expect(playDroneAction.id).toBe('music:play_drone_on_instrument');
      expect(playDroneAction.name).toBe('Play Drone on Instrument');
      expect(playDroneAction.description).toContain('sustained, continuous tone');
      expect(playDroneAction.template).toBe('play drone on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playDroneAction.targets).toBeDefined();
      expect(playDroneAction.targets.primary).toBeDefined();
      expect(playDroneAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playDroneAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playDroneAction.required_components).toBeDefined();
      expect(playDroneAction.required_components.actor).toBeDefined();
      expect(playDroneAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(playDroneAction.required_components.primary).toBeDefined();
      expect(playDroneAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(playDroneAction.prerequisites).toBeDefined();
      expect(Array.isArray(playDroneAction.prerequisites)).toBe(true);
      expect(playDroneAction.prerequisites.length).toBe(1);
      expect(playDroneAction.prerequisites[0].logic).toBeDefined();
      expect(playDroneAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playDroneAction.visual).toBeDefined();
      expect(playDroneAction.visual.backgroundColor).toBe('#1a2332');
      expect(playDroneAction.visual.textColor).toBe('#d1d5db');
      expect(playDroneAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playDroneAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = ['eerie', 'solemn', 'meditative', 'mournful'];

    compatibleMoods.forEach((mood) => {
      it(`should discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Lyra')
          .atLocation('concert_hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'lute1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('silver lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const droneActions = discoveredActions.filter(
          (action) => action.id === 'music:play_drone_on_instrument'
        );

        expect(droneActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = ['cheerful', 'aggressive', 'playful', 'tense', 'triumphant', 'tender'];

    incompatibleMoods.forEach((mood) => {
      it(`should NOT discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Elara')
          .atLocation('concert_hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'violin1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('violin1')
          .withName('violin')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const droneActions = discoveredActions.filter(
          (action) => action.id === 'music:play_drone_on_instrument'
        );

        expect(droneActions.length).toBe(0);
      });
    });
  });

  describe('Discovery when actor lacks required components', () => {
    it('should NOT discover action when actor lacks is_musician component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const nonMusician = new ModEntityBuilder('actor1')
        .withName('Non-Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks performance_mood component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Moodless Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
    });
  });

  describe('Scope resolution edge cases', () => {
    it('should return empty scope when playing_music references non-existent instrument', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Broken Reference Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'nonexistent_instrument',
        })
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      testFixture.reset([room, musician]);

      const musicianInstance =
        testFixture.entityManager.getEntityInstance('musician1');
      const scopeContext = {
        actor: {
          id: 'musician1',
          components: musicianInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'music:instrument_actor_is_playing',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toHaveLength(0);
    });
  });
});
```

### 6.3 Rule Execution Test Structure

**File**: `tests/integration/mods/music/playDroneOnInstrumentRuleExecution.test.js`

```javascript
/**
 * @file Integration tests for handle_play_drone_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood adjective and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playDroneRule from '../../../../data/mods/music/rules/handle_play_drone_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayDrone from '../../../../data/mods/music/conditions/event-is-action-play-drone-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_drone_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_drone_on_instrument',
      playDroneRule,
      eventIsActionPlayDrone
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_drone_on_instrument action', () => {
    it('should dispatch perceptible event with mood-adjective-flavored message', async () => {
      const room = ModEntityScenarios.createRoom('cathedral', 'Cathedral');

      const musician = new ModEntityBuilder('musician1')
        .withName('Kael')
        .atLocation('cathedral')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'organ1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('organ1')
        .withName('pipe organ')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'organ1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'solemn', the adjective is 'grave'
      expect(perceptibleEvent.payload.descriptionText).toContain('Kael');
      expect(perceptibleEvent.payload.descriptionText).toContain('grave');
      expect(perceptibleEvent.payload.descriptionText).toContain('drone');
      expect(perceptibleEvent.payload.descriptionText).toContain('pipe organ');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/holds a.*drone on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('temple', 'Temple');

      const musician = new ModEntityBuilder('musician1')
        .withName('Lyra')
        .atLocation('temple')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'bowl1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('bowl1')
        .withName('singing bowl')
        .atLocation('temple')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'bowl1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 4 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'eerie', expectedAdj: 'unsettling' },
        { mood: 'solemn', expectedAdj: 'grave' },
        { mood: 'meditative', expectedAdj: 'calm' },
        { mood: 'mournful', expectedAdj: 'aching' },
      ];

      for (const { mood, expectedAdj } of moods) {
        const room = ModEntityScenarios.createRoom('hall', 'Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Performer')
          .atLocation('hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'instrument1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('instrument1')
          .withName('test instrument')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);

        await testFixture.executeAction('musician1', 'instrument1');

        const perceptibleEvents = testFixture.events.filter(
          (e) => e.eventType === 'core:perceptible_event'
        );

        expect(perceptibleEvents.length).toBeGreaterThan(0);

        const perceptibleEvent = perceptibleEvents[0];
        expect(perceptibleEvent.payload.descriptionText).toContain(expectedAdj);
        expect(perceptibleEvent.payload.descriptionText).toContain('drone');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback adjective when mood not found in lexicon', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Bard')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'nonexistent_mood',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      // Should use the fallback value from missing_value parameter
      expect(perceptibleEvent.payload.descriptionText).toContain('resonant');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential drone performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'cello1',
        })
        .withComponent('music:performance_mood', {
          mood: 'mournful',
        })
        .build();

      const instrument = new ModEntityBuilder('cello1')
        .withName('cello')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First drone
      await testFixture.executeAction('musician1', 'cello1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second drone
      await testFixture.executeAction('musician1', 'cello1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('aching');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('monastery', 'Monastery');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('monastery')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'theremin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('theremin1')
        .withName('theremin')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'theremin1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.locationId).toBe('monastery');
    });

    it('should include targetId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Target Test Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('celtic harp')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'harp1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('harp1');
    });
  });
});
```

### 6.4 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Prerequisite Validation**: 100% coverage for all 4 compatible and 6 incompatible moods
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Integration**: Full workflow tests covering all 4 compatible moods

### 6.5 Test Execution Commands

**Action Discovery Test**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playDroneOnInstrumentActionDiscovery.test.js --no-coverage --silent
```

**Rule Execution Test**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playDroneOnInstrumentRuleExecution.test.js --no-coverage --silent
```

**Full Music Mod Test Suite**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent
```

## 7. File Structure Summary

```
data/mods/music/
├── actions/
│   └── play_drone_on_instrument.action.json            [NEW]
├── rules/
│   └── handle_play_drone_on_instrument.rule.json       [NEW]
├── conditions/
│   └── event-is-action-play-drone-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                   [UPDATE]

tests/integration/mods/music/
├── playDroneOnInstrumentActionDiscovery.test.js        [NEW]
└── playDroneOnInstrumentRuleExecution.test.js          [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify `music:instrument_actor_is_playing` scope exists (from previous music actions)
- [ ] Verify `music:mood_lexicon` lookup exists with `adj` field for all moods
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Action Definition

- [ ] Create `data/mods/music/actions/play_drone_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Verify prerequisite logic correctly checks mood compatibility
- [ ] Update `data/mods/music/mod-manifest.json` to include action file

### 8.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_play_drone_on_instrument.rule.json`
- [ ] Verify rule uses `adj` field from mood_lexicon (not `noun` or `adjectives`)
- [ ] Update mod manifest to include rule file

### 8.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-play-drone-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.5 Testing

**Action Discovery Test**:
- [ ] Create `tests/integration/mods/music/playDroneOnInstrumentActionDiscovery.test.js`
- [ ] Verify tests cover all 4 compatible moods
- [ ] Verify tests cover all 6 incompatible moods
- [ ] Verify tests cover action structure validation
- [ ] Verify tests cover component requirement validation
- [ ] Verify tests cover scope resolution edge cases
- [ ] Run test suite and verify all tests pass

**Rule Execution Test**:
- [ ] Create `tests/integration/mods/music/playDroneOnInstrumentRuleExecution.test.js`
- [ ] Verify tests cover all 4 compatible moods with correct adjectives
- [ ] Verify tests validate perceptible event message structure
- [ ] Verify tests validate action success event dispatch
- [ ] Verify tests cover fallback adjective behavior
- [ ] Verify tests cover multiple sequential performances
- [ ] Verify tests validate locationId and targetId in perceptible events
- [ ] Run test suite and verify all tests pass

**Full Test Suite**:
- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`
- [ ] Verify no regression in existing music mod tests

### 8.6 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds (≥80%)

### 8.7 Documentation

- [ ] Update music mod documentation with drone action
- [ ] Document prerequisite pattern for mood-based actions
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `play_drone_on_instrument` action is defined and discoverable
2. ✅ Action only appears when actor has compatible mood (eerie, solemn, meditative, mournful)
3. ✅ Action does NOT appear when actor has incompatible mood (cheerful, aggressive, playful, tense, triumphant, tender)
4. ✅ Prerequisite validation provides helpful failure message
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood adjective from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} holds a {mood_adjective} drone on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass (including all 10 mood scenarios)
10. ✅ All rule execution tests pass (including all 4 compatible moods with correct adjectives)
11. ✅ Test coverage meets 80%+ thresholds
12. ✅ No schema validation errors
13. ✅ No linting errors
14. ✅ No type checking errors

## 10. Design Decisions

### 10.1 Why Restrict to Specific Moods?

**Decision**: Use JSON Logic prerequisites to restrict drone to 4 compatible moods.

**Rationale**:
- **Musical Authenticity**: Drone is a sustained, atmospheric technique that doesn't work well with energetic or upbeat moods
- **Gameplay Depth**: Creates meaningful choices - players must consider mood when choosing techniques
- **Complementary to Ostinato**: While ostinato works with driving/insistent moods, drone works with contemplative/atmospheric moods
- **Pattern Consistency**: Follows established prerequisite pattern from ostinato action
- **Extensibility**: Easy to add more mood-specific techniques in the future

### 10.2 Why Use the Adjective Field from Lexicon?

**Decision**: Use the `adj` field from mood_lexicon rather than `noun` or `adjectives`.

**Rationale**:
- **Grammatical Correctness**: "holds a {adjective} drone" reads naturally (e.g., "holds a grave drone")
- **Distinct from Ostinato**: Ostinato uses `noun` field, so using `adj` differentiates the techniques
- **Single Descriptor**: `adj` provides a single primary adjective, while `adjectives` is comma-separated
- **Lexicon Flexibility**: Demonstrates multiple uses of the mood_lexicon lookup
- **Narrative Variety**: Provides different descriptive words than ostinato and phrase actions

### 10.3 Why Reuse Existing Scope?

**Decision**: Use the existing `music:instrument_actor_is_playing` scope.

**Rationale**:
- **Code Reuse**: Scope already exists and works correctly
- **Consistency**: All music performance actions target the currently-played instrument
- **Maintainability**: Single scope definition for related actions
- **Performance**: No additional scope registration or resolution overhead

### 10.4 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Consistency**: Matches pattern from `play_ostinato_on_instrument` and `play_phrase_on_instrument` actions

### 10.5 Why Different Moods Than Ostinato?

**Decision**: Drone uses eerie/solemn/meditative/mournful, while ostinato uses tense/cheerful/aggressive/playful/meditative/solemn.

**Rationale**:
- **Musical Distinction**: Ostinato is repetitive/driving, drone is sustained/atmospheric
- **Mood Overlap**: Meditative and solemn work for both (versatile moods)
- **Clear Separation**: Aggressive/playful/tense don't suit sustained drones, while eerie/mournful don't suit repetitive ostinatos
- **Player Choice**: Forces meaningful decisions about which technique fits the current mood

## 11. Future Enhancements

### 11.1 Drone Duration and Intensity

Add component to track drone characteristics:
- `music:performing_drone` component with duration and intensity
- Long drones have increased atmospheric impact
- Intensity affects volume and presence in the environment

### 11.2 Harmonic Drone Variations

Customize drone types per mood:
- Eerie: Dissonant, unsettling harmonics
- Meditative: Pure, resonant fundamentals
- Mournful: Minor intervals, lamenting tones
- Solemn: Bass-heavy, grave foundations

### 11.3 Drone and Ostinato Combination

Enable layered techniques:
- Allow drone as foundation with ostinato overlay
- Requires high musical skill
- Creates complex, textured performances

### 11.4 Instrument-Specific Drone Capabilities

Different instruments have different drone characteristics:
- Bagpipes: Natural drone mechanism
- Organs: Multiple drone pipes
- String instruments: Sympathetic resonance
- Wind instruments: Circular breathing required

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/play-ostinato-on-instrument-action.spec.md` - Similar prerequisite-based musical action
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview
- `data/schemas/action.schema.json` - Action schema with prerequisite definitions

### 12.3 Reference Files

- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup
- `data/mods/music/actions/play_ostinato_on_instrument.action.json` - Similar mood-gated action
- `data/mods/music/actions/play_phrase_on_instrument.action.json` - Base music performance action
- `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-06
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "play drone on instrument" action to the Living Narrative Engine music mod. The design prioritizes musical authenticity, prerequisite validation, and comprehensive testing while maintaining consistency with existing music mod patterns._
