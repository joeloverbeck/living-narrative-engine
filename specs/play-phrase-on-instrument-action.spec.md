# Play Phrase on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-05
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians who are already playing an instrument to perform expressive phrases that reflect their current performance mood. Unlike the mood-setting actions (which initialize or change the performance mood), this action leverages the existing mood to generate varied, dynamic musical expressions during an ongoing performance.

### 1.2 Motivation

Building on the music mood-setting actions defined in `specs/music-mood-setting-actions.spec.md`, this feature provides:

1. **Expressive Gameplay**: Musicians can continuously perform musical phrases without repeatedly setting moods
2. **Mood Reflection**: Each phrase reflects the current `performance_mood` component value
3. **Dynamic Performance**: Supports ongoing, evolving musical performances with varied phrasing
4. **Natural Flow**: Separates mood-setting (rare, deliberate) from phrase-playing (frequent, expressive)

### 1.3 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component

### 1.4 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `specs/wcag-compliant-color-combinations.spec.md` - Visual identity for music mod

## 2. Scope Definition

### 2.1 New Scope: instrument_actor_is_playing

The action requires a new scope that resolves to the specific instrument entity referenced in the actor's `music:playing_music` component. This follows the pattern established by `positioning:actor_im_straddling`.

**File**: `data/mods/music/scopes/instrument_actor_is_playing.scope`

```
music:instrument_actor_is_playing := entities(core:actor)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.music:playing_music.playing_on"}
  ]
}]
```

**Scope Behavior**:
- **Input Context**: Requires `actor` with `music:playing_music` component
- **Resolution**: Returns the single entity whose ID matches the `playing_on` field value
- **Result**: Either a single-element set containing the instrument, or an empty set if:
  - Actor lacks `music:playing_music` component
  - The `playing_on` field references a non-existent entity
  - The referenced entity has been destroyed/removed

**Example**:
```javascript
// Actor has component:
// music:playing_music: { playing_on: "lute_42" }

// Scope resolves to: Set(["lute_42"])
```

### 2.2 Scope Registration in Mod Manifest

**File**: `data/mods/music/mod-manifest.json` (update)

```json
{
  "content": {
    "components": [...],
    "actions": [...],
    "rules": [...],
    "conditions": [...],
    "scopes": [
      "instrument_actor_is_playing.scope"
    ],
    "lookups": [...]
  }
}
```

## 3. Action Definition

### 3.1 Action Structure

**File**: `data/mods/music/actions/play_phrase_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:play_phrase_on_instrument",
  "name": "Play Phrase on Instrument",
  "description": "Perform an expressive musical phrase on the instrument you are currently playing, reflecting the current performance mood.",
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
  "prerequisites": [],
  "template": "play phrase on {instrument}",
  "visual": {
    "backgroundColor": "#1a2332",
    "textColor": "#d1d5db",
    "hoverBackgroundColor": "#2d3748",
    "hoverTextColor": "#f3f4f6"
  }
}
```

### 3.2 Key Design Decisions

**Primary Target Scope**: Uses `music:instrument_actor_is_playing` to ensure:
- Only the currently-played instrument appears as a valid target
- Actor cannot attempt to play phrases on instruments they're not currently playing
- Scope resolution fails gracefully if actor stops playing

**Required Components**:
- **Actor Requirements**:
  - `music:is_musician` - Must be a trained musician
  - `music:playing_music` - Must be actively playing an instrument
  - `music:performance_mood` - Must have an established performance mood
- **Primary Requirements**:
  - `items:item` - Target must be a valid item entity
  - `music:is_instrument` - Target must be a recognized instrument

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

## 4. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-play-phrase-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-play-phrase-on-instrument",
  "description": "Evaluates to true when the event is an attempt to play a phrase on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:play_phrase_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 5. Rule Definition

### 5.1 Rule Structure

**File**: `data/mods/music/rules/handle_play_phrase_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_play_phrase_on_instrument",
  "comment": "Handles playing an expressive phrase on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-play-phrase-on-instrument"
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
      "comment": "Retrieve mood descriptors from lexicon for narrative variation",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adjectives": "expressive" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "phraseMessage",
        "value": "{context.actorName} shapes a {context.moodDescriptor.adjectives} phrase on the {context.instrumentName}."
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

### 5.2 Rule Operation Flow

1. **Name Resolution**: Capture actor and instrument names for message composition
2. **Position Query**: Retrieve actor location for perceptible event dispatch
3. **Mood Query**: Extract current `performance_mood.mood` value from actor
4. **Lexicon Lookup**: Retrieve mood adjectives from `music:mood_lexicon` using the current mood as key
5. **Message Composition**: Build perceptible event message using format: `{actor} shapes a {mood_adjectives} phrase on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 5.3 Message Examples

Based on different performance moods (using `adjectives` field from mood_lexicon):

| Mood | Message |
|------|---------|
| **cheerful** | "Lyra shapes a bright, skipping phrase on the silver lute." |
| **solemn** | "Marcus shapes a measured, weighty phrase on the grand organ." |
| **mournful** | "Elara shapes a low, aching phrase on the violin." |
| **eerie** | "Corvus shapes a thin, uneasy phrase on the theremin." |
| **tense** | "Kael shapes an insistent, tight phrase on the war drums." |
| **triumphant** | "Victoria shapes a ringing, bold phrase on the trumpet." |
| **tender** | "Aria shapes a soft, warm phrase on the harp." |
| **playful** | "Felix shapes a quick, teasing phrase on the flute." |
| **aggressive** | "Draven shapes a driving, sharp phrase on the electric guitar." |
| **meditative** | "Zara shapes a slow, even phrase on the chimes." |

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js`

**Scope Resolution Test**:
`tests/integration/mods/music/instrumentActorIsPlayingScopeResolution.test.js`

### 6.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for music:play_phrase_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor is actively playing an instrument with a mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playPhraseAction from '../../../../data/mods/music/actions/play_phrase_on_instrument.action.json' assert { type: 'json' };

describe('music:play_phrase_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_phrase_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(playPhraseAction).toBeDefined();
      expect(playPhraseAction.id).toBe('music:play_phrase_on_instrument');
      expect(playPhraseAction.name).toBe('Play Phrase on Instrument');
      expect(playPhraseAction.description).toContain('expressive musical phrase');
      expect(playPhraseAction.template).toBe('play phrase on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playPhraseAction.targets).toBeDefined();
      expect(playPhraseAction.targets.primary).toBeDefined();
      expect(playPhraseAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playPhraseAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playPhraseAction.required_components).toBeDefined();
      expect(playPhraseAction.required_components.actor).toBeDefined();
      expect(playPhraseAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(playPhraseAction.required_components.primary).toBeDefined();
      expect(playPhraseAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(playPhraseAction.prerequisites).toBeDefined();
      expect(Array.isArray(playPhraseAction.prerequisites)).toBe(true);
      expect(playPhraseAction.prerequisites).toEqual([]);
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playPhraseAction.visual).toBeDefined();
      expect(playPhraseAction.visual.backgroundColor).toBe('#1a2332');
      expect(playPhraseAction.visual.textColor).toBe('#d1d5db');
      expect(playPhraseAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playPhraseAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery scenarios', () => {
    describe('When musician is actively playing with a mood', () => {
      it('should discover play_phrase_on_instrument action', () => {
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
            mood: 'cheerful',
          })
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('silver lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(1);
      });

      it('should resolve scope to the instrument being played', () => {
        const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

        const musician = new ModEntityBuilder('musician1')
          .withName('Marcus')
          .atLocation('studio')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'piano1',
          })
          .withComponent('music:performance_mood', {
            mood: 'solemn',
          })
          .build();

        const piano = new ModEntityBuilder('piano1')
          .withName('grand piano')
          .atLocation('studio')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        const otherInstrument = new ModEntityBuilder('violin1')
          .withName('violin')
          .atLocation('studio')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, piano, otherInstrument]);

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
        expect(Array.from(scopeResult.value)).toEqual(['piano1']);
        // Should NOT include violin1
        expect(Array.from(scopeResult.value)).not.toContain('violin1');
      });
    });

    describe('When actor lacks required components', () => {
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
            mood: 'cheerful',
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, nonMusician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
      });

      it('should NOT discover action when actor lacks playing_music component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Room');

        const musician = new ModEntityBuilder('musician1')
          .withName('Not Playing Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:performance_mood', {
            mood: 'cheerful',
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
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
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
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
            mood: 'cheerful',
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

      it('should return empty scope when actor has no playing_music component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Room');

        const musician = new ModEntityBuilder('musician1')
          .withName('Not Playing')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
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
});
```

### 6.3 Rule Execution Test Structure

**File**: `tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js`

```javascript
/**
 * @file Integration tests for handle_play_phrase_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood descriptors and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playPhraseRule from '../../../../data/mods/music/rules/handle_play_phrase_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayPhrase from '../../../../data/mods/music/conditions/event-is-action-play-phrase-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_phrase_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_phrase_on_instrument',
      playPhraseRule,
      eventIsActionPlayPhrase
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_phrase_on_instrument action', () => {
    it('should dispatch perceptible event with mood-flavored message', async () => {
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
          mood: 'cheerful',
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
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
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjectives from the lookup
      // For 'cheerful', the adjectives are 'bright, skipping'
      expect(perceptibleEvent.payload.descriptionText).toContain('Lyra');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'bright, skipping'
      );
      expect(perceptibleEvent.payload.descriptionText).toContain('silver lute');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/shapes a.*phrase on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'piano1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('grand piano')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'piano1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 10 moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'cheerful', expectedAdjectives: 'bright, skipping' },
        { mood: 'solemn', expectedAdjectives: 'measured, weighty' },
        { mood: 'mournful', expectedAdjectives: 'low, aching' },
        { mood: 'eerie', expectedAdjectives: 'thin, uneasy' },
        { mood: 'tense', expectedAdjectives: 'insistent, tight' },
        { mood: 'triumphant', expectedAdjectives: 'ringing, bold' },
        { mood: 'tender', expectedAdjectives: 'soft, warm' },
        { mood: 'playful', expectedAdjectives: 'quick, teasing' },
        { mood: 'aggressive', expectedAdjectives: 'driving, sharp' },
        { mood: 'meditative', expectedAdjectives: 'slow, even' },
      ];

      for (const { mood, expectedAdjectives } of moods) {
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
        expect(perceptibleEvent.payload.descriptionText).toContain(
          expectedAdjectives
        );

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
      expect(perceptibleEvent.payload.descriptionText).toContain('expressive');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential phrase performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'violin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tender',
        })
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First phrase
      await testFixture.executeAction('musician1', 'violin1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second phrase
      await testFixture.executeAction('musician1', 'violin1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain(
        'soft, warm'
      );
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('golden harp')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'harp1');

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
          playing_on: 'drum1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('war drum')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drum1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('drum1');
    });
  });
});
```

### 6.4 Scope Resolution Test Structure

**File**: `tests/integration/mods/music/instrumentActorIsPlayingScopeResolution.test.js`

```javascript
/**
 * @file Integration tests for music:instrument_actor_is_playing scope resolution.
 * @description Tests the scope that resolves to the instrument referenced in actor's playing_music component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

describe('music:instrument_actor_is_playing - Scope Resolution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_phrase_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successful resolution', () => {
    it('should resolve to the instrument being played by actor', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'target_lute',
        })
        .build();

      const targetInstrument = new ModEntityBuilder('target_lute')
        .withName('target lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      const otherInstrument = new ModEntityBuilder('other_lute')
        .withName('other lute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, targetInstrument, otherInstrument]);

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
      const resolvedIds = Array.from(scopeResult.value);
      expect(resolvedIds).toHaveLength(1);
      expect(resolvedIds).toContain('target_lute');
      expect(resolvedIds).not.toContain('other_lute');
    });

    it('should resolve correctly when instrument is at different location', () => {
      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room_a')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'distant_lute',
        })
        .build();

      const instrument = new ModEntityBuilder('distant_lute')
        .withName('distant lute')
        .atLocation('room_b')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([roomA, roomB, musician, instrument]);

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
      const resolvedIds = Array.from(scopeResult.value);
      expect(resolvedIds).toContain('distant_lute');
    });
  });

  describe('Failed resolution', () => {
    it('should return empty set when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing')
        .atLocation('room1')
        .asActor()
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

    it('should return empty set when playing_on references non-existent entity', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'nonexistent_instrument_id',
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

    it('should return empty set when playing_on field is missing', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          // Missing playing_on field
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

  describe('Component data integrity', () => {
    it('should follow the exact ID stored in playing_on field', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Precise Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'specific_id_12345',
        })
        .build();

      const instrument = new ModEntityBuilder('specific_id_12345')
        .withName('specifically identified instrument')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

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
      expect(Array.from(scopeResult.value)).toEqual(['specific_id_12345']);
    });
  });
});
```

### 6.5 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Scope Resolution**: ≥90% coverage (new scope infrastructure)
- **Integration**: Full workflow tests covering all 10 moods

## 7. File Structure Summary

```
data/mods/music/
├── scopes/
│   └── instrument_actor_is_playing.scope                [NEW]
├── actions/
│   └── play_phrase_on_instrument.action.json            [NEW]
├── rules/
│   └── handle_play_phrase_on_instrument.rule.json       [NEW]
├── conditions/
│   └── event-is-action-play-phrase-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                    [UPDATE]

tests/integration/mods/music/
├── playPhraseOnInstrumentActionDiscovery.test.js        [NEW]
├── playPhraseOnInstrumentRuleExecution.test.js          [NEW]
└── instrumentActorIsPlayingScopeResolution.test.js      [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify mood-setting actions are implemented (per `specs/music-mood-setting-actions.spec.md`)
- [ ] Verify `music:mood_lexicon` lookup exists and is loaded correctly
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Scope Definition

- [ ] Create `data/mods/music/scopes/instrument_actor_is_playing.scope`
- [ ] Update `data/mods/music/mod-manifest.json` to include scope file
- [ ] Verify scope loads correctly during mod initialization

### 8.3 Action Definition

- [ ] Create `data/mods/music/actions/play_phrase_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Update mod manifest to include action file

### 8.4 Rule Definition

- [ ] Create `data/mods/music/rules/handle_play_phrase_on_instrument.rule.json`
- [ ] Update mod manifest to include rule file

### 8.5 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-play-phrase-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.6 Testing

**Action Discovery Test**:
- [ ] Create `tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js`
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js --no-coverage --silent`

**Rule Execution Test**:
- [ ] Create `tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js`
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js --no-coverage --silent`

**Scope Resolution Test**:
- [ ] Create `tests/integration/mods/music/instrumentActorIsPlayingScopeResolution.test.js`
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/instrumentActorIsPlayingScopeResolution.test.js --no-coverage --silent`

**Full Test Suite**:
- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`

### 8.7 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds

### 8.8 Documentation

- [ ] Update `CLAUDE.md` if new patterns introduced
- [ ] Document scope pattern in relevant guides
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `music:instrument_actor_is_playing` scope is defined and loads correctly
2. ✅ Scope resolves to the instrument referenced in `playing_music.playing_on`
3. ✅ `play_phrase_on_instrument` action is defined and discoverable
4. ✅ Action only appears when actor has all three required components
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood adjectives from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} shapes a {mood_adjectives} phrase on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass
10. ✅ All rule execution tests pass
11. ✅ All scope resolution tests pass
12. ✅ Test coverage meets 80%+ thresholds
13. ✅ No schema validation errors
14. ✅ No linting errors
15. ✅ No type checking errors

## 10. Design Decisions

### 10.1 Why a Component-Lookup Scope?

**Decision**: Create a new scope that resolves via component field lookup.

**Rationale**:
- **Explicit Targeting**: Ensures action only targets the instrument currently being played
- **State Binding**: Tightly couples the action to the performance state (`playing_music` component)
- **Pattern Reuse**: Follows established pattern from `positioning:actor_im_straddling`
- **Safety**: Prevents accidental phrase-playing on wrong instrument

### 10.2 Why Separate from Mood-Setting Actions?

**Decision**: Create a distinct action rather than modifying mood-setting actions.

**Rationale**:
- **Different Prerequisites**: Requires existing `playing_music` and `performance_mood` components
- **Different Purpose**: Expresses phrases vs. establishing/changing mood
- **Gameplay Flow**: Supports continuous performance without constant mood changes
- **Discoverability**: Clear semantic difference for players

### 10.3 Why Use Adjectives Field from Lexicon?

**Decision**: Use the `adjectives` field (comma-separated list) rather than `adj` (single adjective).

**Rationale**:
- **Narrative Variety**: Provides richer, more varied descriptions
- **Expressiveness**: Multiple adjectives better capture nuanced musical phrasing
- **Consistency**: Matches established lexicon structure from mood-setting spec
- **Flexibility**: Modders can customize adjective lists per mood

### 10.4 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Separation of Concerns**: Mood-setting changes state; phrase-playing expresses state

## 11. Future Enhancements

### 11.1 Phrase Variation System

Add complexity tiers for phrases:
- Simple phrases (default)
- Complex phrases (skill-based)
- Virtuosic phrases (expertise required)

### 11.2 Audience Reaction

Track listener responses to phrases:
- Mood appreciation scores
- Crowd engagement mechanics
- Performance quality feedback

### 11.3 Phrase Chaining

Support sequential phrase combinations:
- Phrase sequences
- Musical motif tracking
- Repetition detection and variation

### 11.4 Instrument-Specific Phrasing

Customize phrase descriptors per instrument type:
- Percussion phrasing (rhythmic patterns)
- String phrasing (bowing techniques)
- Wind phrasing (breath control)

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview

### 12.3 Reference Files

- `data/mods/positioning/scopes/actor_im_straddling.scope` - Component-lookup scope pattern
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup
- `data/mods/music/actions/set_cheerful_mood_on_instrument.action.json` - Action structure reference
- `tests/integration/mods/music/setAggressiveMoodOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/setAggressiveMoodOnInstrumentRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-05
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "play phrase on instrument" action to the Living Narrative Engine music mod. The design prioritizes state preservation, expressive gameplay, and consistency with existing music mod patterns._
