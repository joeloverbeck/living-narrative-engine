# Play Ostinato on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-05
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to perform an **ostinato** - a repetitive musical pattern - on the instrument they are currently playing. Unlike the general phrase-playing action, this action is restricted to specific performance moods that are compatible with ostinato as a musical archetype.

### 1.2 Motivation

Building on the music phrase-playing action defined in `specs/play-phrase-on-instrument-action.spec.md`, this feature provides:

1. **Musical Archetype Specificity**: Ostinato is a distinct musical technique requiring specific moods
2. **Mood-Based Gameplay Constraints**: Not all moods support ostinato patterns (e.g., mournful, eerie, triumphant, tender are incompatible)
3. **Expressive Depth**: Provides a specialized musical technique alongside general phrase-playing
4. **Prerequisite Pattern Demonstration**: Showcases JSON Logic prerequisites for component property validation

### 1.3 Musical Context: Ostinato

An **ostinato** is a musical motif or phrase that persistently repeats in the same musical voice. It is characterized by:

- **Repetitive Pattern**: Short melodic or rhythmic phrase repeated cyclically
- **Mood Compatibility**: Works best with driving, insistent, or rhythmic moods
- **Incompatibility**: Doesn't work well with flowing, expressive, or dramatically changing moods

**Compatible Moods**: tense, cheerful, aggressive, playful, meditative, solemn
**Incompatible Moods**: mournful, eerie, triumphant, tender

### 1.4 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component (optional)

### 1.5 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `docs/mods/mod-color-schemes.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/play_ostinato_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:play_ostinato_on_instrument",
  "name": "Play Ostinato on Instrument",
  "description": "Lock into a repetitive musical pattern (ostinato) on the instrument you are currently playing. This technique works best with driving, insistent, or rhythmic moods.",
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
          ["tense", "cheerful", "aggressive", "playful", "meditative", "solemn"]
        ]
      },
      "failure_message": "Ostinato patterns don't work well with your current performance mood. Try a mood that's more driving, insistent, or rhythmic."
    }
  ],
  "template": "play ostinato on {instrument}",
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
- Actor cannot attempt ostinato on instruments they're not currently playing
- Scope resolution fails gracefully if actor stops playing

**Required Components**: Identical to `play_phrase_on_instrument`:
- **Actor Requirements**:
  - `music:is_musician` - Must be a trained musician
  - `music:playing_music` - Must be actively playing an instrument
  - `music:performance_mood` - Must have an established performance mood
- **Primary Requirements**:
  - `items:item` - Target must be a valid item entity
  - `music:is_instrument` - Target must be a recognized instrument

**Prerequisites**: JSON Logic validation checking mood compatibility:
- Uses `in` operator to check if `performance_mood.mood` is in the compatible list
- Compatible moods: `tense`, `cheerful`, `aggressive`, `playful`, `meditative`, `solemn`
- Provides player-friendly failure message when mood is incompatible

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

### 2.3 Prerequisite Logic Explanation

The prerequisite validates that the actor's current performance mood is compatible with ostinato:

```json
{
  "in": [
    {"var": "actor.components.music:performance_mood.mood"},
    ["tense", "cheerful", "aggressive", "playful", "meditative", "solemn"]
  ]
}
```

This JSON Logic expression:
1. Retrieves the `mood` property from the actor's `music:performance_mood` component
2. Checks if the mood value is present in the array of compatible moods
3. Returns `true` if compatible, `false` if incompatible
4. If `false`, the action is filtered out during discovery and the failure message is logged

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-play-ostinato-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-play-ostinato-on-instrument",
  "description": "Evaluates to true when the event is an attempt to play an ostinato on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:play_ostinato_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_play_ostinato_on_instrument",
  "comment": "Handles playing an ostinato (repetitive musical pattern) on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-play-ostinato-on-instrument"
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
      "comment": "Retrieve mood descriptors from lexicon, specifically the noun form for ostinato message",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "noun": "rhythmic" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} locks into a {context.moodDescriptor.noun} ostinato on the {context.instrumentName}."
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
4. **Lexicon Lookup**: Retrieve mood **noun** from `music:mood_lexicon` using the current mood as key
5. **Message Composition**: Build perceptible event message using format: `{actor} locks into a {mood_noun} ostinato on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Examples

Based on compatible performance moods (using `noun` field from mood_lexicon):

| Mood | Noun | Message |
|------|------|---------|
| **tense** | tight | "Kael locks into a tight ostinato on the war drums." |
| **cheerful** | bouncy | "Lyra locks into a bouncy ostinato on the silver lute." |
| **aggressive** | hard-driving | "Draven locks into a hard-driving ostinato on the electric guitar." |
| **playful** | skipping | "Felix locks into a skipping ostinato on the flute." |
| **meditative** | steady | "Zara locks into a steady ostinato on the chimes." |
| **solemn** | grave | "Marcus locks into a grave ostinato on the grand organ." |

**Note**: The following moods are **not compatible** and will cause the action to be filtered during discovery:
- mournful (woeful)
- eerie (hollow)
- triumphant (bold)
- tender (delicate)

## 5. Mod Manifest Update

**File**: `data/mods/music/mod-manifest.json` (update)

Add the following entries to the appropriate sections:

```json
{
  "content": {
    "actions": [
      "play_ostinato_on_instrument.action.json"
    ],
    "rules": [
      "handle_play_ostinato_on_instrument.rule.json"
    ],
    "conditions": [
      "event-is-action-play-ostinato-on-instrument.condition.json"
    ]
  }
}
```

**Note**: The `instrument_actor_is_playing.scope` already exists from the `play_phrase_on_instrument` action, so no scope updates are needed.

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js`

### 6.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for music:play_ostinato_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playOstinatoAction from '../../../../data/mods/music/actions/play_ostinato_on_instrument.action.json' assert { type: 'json' };

describe('music:play_ostinato_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_ostinato_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(playOstinatoAction).toBeDefined();
      expect(playOstinatoAction.id).toBe('music:play_ostinato_on_instrument');
      expect(playOstinatoAction.name).toBe('Play Ostinato on Instrument');
      expect(playOstinatoAction.description).toContain('repetitive musical pattern');
      expect(playOstinatoAction.template).toBe('play ostinato on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playOstinatoAction.targets).toBeDefined();
      expect(playOstinatoAction.targets.primary).toBeDefined();
      expect(playOstinatoAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playOstinatoAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playOstinatoAction.required_components).toBeDefined();
      expect(playOstinatoAction.required_components.actor).toBeDefined();
      expect(playOstinatoAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(playOstinatoAction.required_components.primary).toBeDefined();
      expect(playOstinatoAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(playOstinatoAction.prerequisites).toBeDefined();
      expect(Array.isArray(playOstinatoAction.prerequisites)).toBe(true);
      expect(playOstinatoAction.prerequisites.length).toBe(1);
      expect(playOstinatoAction.prerequisites[0].logic).toBeDefined();
      expect(playOstinatoAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playOstinatoAction.visual).toBeDefined();
      expect(playOstinatoAction.visual.backgroundColor).toBe('#1a2332');
      expect(playOstinatoAction.visual.textColor).toBe('#d1d5db');
      expect(playOstinatoAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playOstinatoAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = ['tense', 'cheerful', 'aggressive', 'playful', 'meditative', 'solemn'];

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
        testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const ostinatoActions = discoveredActions.filter(
          (action) => action.id === 'music:play_ostinato_on_instrument'
        );

        expect(ostinatoActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = ['mournful', 'eerie', 'triumphant', 'tender'];

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
        testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const ostinatoActions = discoveredActions.filter(
          (action) => action.id === 'music:play_ostinato_on_instrument'
        );

        expect(ostinatoActions.length).toBe(0);
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
          mood: 'tense',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const ostinatoActions = discoveredActions.filter(
        (action) => action.id === 'music:play_ostinato_on_instrument'
      );

      expect(ostinatoActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'tense',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const ostinatoActions = discoveredActions.filter(
        (action) => action.id === 'music:play_ostinato_on_instrument'
      );

      expect(ostinatoActions.length).toBe(0);
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
      testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const ostinatoActions = discoveredActions.filter(
        (action) => action.id === 'music:play_ostinato_on_instrument'
      );

      expect(ostinatoActions.length).toBe(0);
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
          mood: 'tense',
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

**File**: `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js`

```javascript
/**
 * @file Integration tests for handle_play_ostinato_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood noun and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playOstinatoRule from '../../../../data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayOstinato from '../../../../data/mods/music/conditions/event-is-action-play-ostinato-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_ostinato_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_ostinato_on_instrument',
      playOstinatoRule,
      eventIsActionPlayOstinato
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_ostinato_on_instrument action', () => {
    it('should dispatch perceptible event with mood-noun-flavored message', async () => {
      const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Kael')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drums1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tense',
        })
        .build();

      const instrument = new ModEntityBuilder('drums1')
        .withName('war drums')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drums1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood noun from the lookup
      // For 'tense', the noun is 'tight'
      expect(perceptibleEvent.payload.descriptionText).toContain('Kael');
      expect(perceptibleEvent.payload.descriptionText).toContain('tight');
      expect(perceptibleEvent.payload.descriptionText).toContain('ostinato');
      expect(perceptibleEvent.payload.descriptionText).toContain('war drums');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/locks into a.*ostinato on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Lyra')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'cheerful',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 6 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'tense', expectedNoun: 'tight' },
        { mood: 'cheerful', expectedNoun: 'bouncy' },
        { mood: 'aggressive', expectedNoun: 'hard-driving' },
        { mood: 'playful', expectedNoun: 'skipping' },
        { mood: 'meditative', expectedNoun: 'steady' },
        { mood: 'solemn', expectedNoun: 'grave' },
      ];

      for (const { mood, expectedNoun } of moods) {
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
        expect(perceptibleEvent.payload.descriptionText).toContain(expectedNoun);
        expect(perceptibleEvent.payload.descriptionText).toContain('ostinato');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback noun when mood not found in lexicon', async () => {
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
      expect(perceptibleEvent.payload.descriptionText).toContain('rhythmic');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential ostinato performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'piano1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('piano')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First ostinato
      await testFixture.executeAction('musician1', 'piano1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second ostinato
      await testFixture.executeAction('musician1', 'piano1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('steady');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'guitar1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('guitar1')
        .withName('electric guitar')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'guitar1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.locationId).toBe('grand_hall');
    });

    it('should include targetId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Target Test Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'flute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('flute1')
        .withName('wooden flute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'flute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('flute1');
    });
  });
});
```

### 6.4 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Prerequisite Validation**: 100% coverage for all 6 compatible and 4 incompatible moods
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Integration**: Full workflow tests covering all 6 compatible moods

## 7. File Structure Summary

```
data/mods/music/
├── actions/
│   └── play_ostinato_on_instrument.action.json            [NEW]
├── rules/
│   └── handle_play_ostinato_on_instrument.rule.json       [NEW]
├── conditions/
│   └── event-is-action-play-ostinato-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                      [UPDATE]

tests/integration/mods/music/
├── playOstinatoOnInstrumentActionDiscovery.test.js        [NEW]
└── playOstinatoOnInstrumentRuleExecution.test.js          [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify `music:instrument_actor_is_playing` scope exists (from play_phrase_on_instrument action)
- [ ] Verify `music:mood_lexicon` lookup exists with `noun` field for all moods
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Action Definition

- [ ] Create `data/mods/music/actions/play_ostinato_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Verify prerequisite logic correctly checks mood compatibility
- [ ] Update `data/mods/music/mod-manifest.json` to include action file

### 8.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json`
- [ ] Verify rule uses `noun` field from mood_lexicon (not `adjectives`)
- [ ] Update mod manifest to include rule file

### 8.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-play-ostinato-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.5 Testing

**Action Discovery Test**:
- [ ] Create `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js`
- [ ] Verify tests cover all 6 compatible moods
- [ ] Verify tests cover all 4 incompatible moods
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js --no-coverage --silent`

**Rule Execution Test**:
- [ ] Create `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js`
- [ ] Verify tests cover all 6 compatible moods with correct nouns
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js --no-coverage --silent`

**Full Test Suite**:
- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`

### 8.6 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds

### 8.7 Documentation

- [ ] Update music mod documentation with ostinato action
- [ ] Document prerequisite pattern for mood-based actions
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `play_ostinato_on_instrument` action is defined and discoverable
2. ✅ Action only appears when actor has compatible mood (tense, cheerful, aggressive, playful, meditative, solemn)
3. ✅ Action does NOT appear when actor has incompatible mood (mournful, eerie, triumphant, tender)
4. ✅ Prerequisite validation provides helpful failure message
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood noun from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} locks into a {mood_noun} ostinato on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass (including all 10 mood scenarios)
10. ✅ All rule execution tests pass
11. ✅ Test coverage meets 80%+ thresholds
12. ✅ No schema validation errors
13. ✅ No linting errors
14. ✅ No type checking errors

## 10. Design Decisions

### 10.1 Why Restrict to Specific Moods?

**Decision**: Use JSON Logic prerequisites to restrict ostinato to 6 compatible moods.

**Rationale**:
- **Musical Authenticity**: Ostinato is a repetitive pattern that doesn't work well with flowing, expressive moods
- **Gameplay Depth**: Creates meaningful choices - players must consider mood when choosing techniques
- **Pattern Demonstration**: Showcases prerequisite system for component property validation
- **Extensibility**: Easy to add more mood-specific techniques in the future

### 10.2 Why Use the Noun Field from Lexicon?

**Decision**: Use the `noun` field from mood_lexicon rather than `adjectives`.

**Rationale**:
- **Grammatical Correctness**: "locks into a {noun} ostinato" reads naturally
- **Distinct from Phrases**: Differentiates ostinato from general phrase-playing
- **Lexicon Flexibility**: Demonstrates multiple uses of the mood_lexicon lookup
- **Narrative Variety**: Provides different descriptive words than phrase action

### 10.3 Why Reuse Existing Scope?

**Decision**: Use the existing `music:instrument_actor_is_playing` scope.

**Rationale**:
- **Code Reuse**: Scope already exists and works correctly
- **Consistency**: Both actions target the currently-played instrument
- **Maintainability**: Single scope definition for related actions
- **Performance**: No additional scope registration or resolution overhead

### 10.4 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Consistency**: Matches pattern from `play_phrase_on_instrument` action

## 11. Future Enhancements

### 11.1 Ostinato Duration Tracking

Add component to track ostinato performance duration:
- `music:performing_ostinato` component with start timestamp
- Duration affects narrative descriptions
- Long ostinato performances have special effects

### 11.2 Mood-Specific Ostinato Variations

Customize ostinato types per mood:
- Aggressive: Driving, percussive patterns
- Meditative: Minimalist, repetitive phrases
- Playful: Quick, bouncing motifs
- Solemn: Measured, processional patterns

### 11.3 Ostinato Complexity Levels

Introduce skill-based complexity:
- Simple ostinato (default)
- Polyrhythmic ostinato (advanced)
- Layered ostinato (expert)

### 11.4 Break from Ostinato Action

Add complementary action to end ostinato:
- `break_from_ostinato` action
- Transitions to different musical technique
- Narrative acknowledgment of pattern change

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview
- `data/schemas/action.schema.json` - Action schema with prerequisite definitions

### 12.3 Reference Files

- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup
- `data/mods/music/actions/play_phrase_on_instrument.action.json` - Similar action pattern
- `data/mods/seduction/actions/draw_attention_to_breasts.action.json` - Prerequisite example
- `tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-05
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "play ostinato on instrument" action to the Living Narrative Engine music mod. The design prioritizes musical authenticity, prerequisite validation, and comprehensive testing while maintaining consistency with existing music mod patterns._
