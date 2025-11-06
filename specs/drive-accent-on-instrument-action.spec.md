# Drive Accent on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-06
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to **drive an accent** - a pronounced emphasis on a musical note or chord - on the instrument they are currently playing. Unlike the ostinato action which emphasizes repetitive patterns, this action focuses on emphatic, singular moments of intensity requiring specific performance moods.

### 1.2 Motivation

Building on the music actions defined in `specs/play-ostinato-on-instrument-action.spec.md` and `specs/play-phrase-on-instrument-action.spec.md`, this feature provides:

1. **Musical Expression Specificity**: Accents are distinct emphatic techniques requiring forceful, intense moods
2. **Mood-Based Gameplay Constraints**: Only moods supporting emphatic expression are compatible (aggressive, triumphant, tense, solemn)
3. **Expressive Depth**: Provides specialized technique for moments of musical emphasis
4. **Complementary Technique**: Pairs with ostinato and phrase-playing to create varied musical vocabulary

### 1.3 Musical Context: Accents

A **musical accent** (or **accentuation**) is an emphasis, stress, or stronger attack placed on a particular note or chord. It is characterized by:

- **Emphasis**: Pronounced intensity on a single note or chord
- **Attack**: Sharp or strong onset of sound
- **Mood Compatibility**: Works best with forceful, emphatic, or intense moods
- **Incompatibility**: Doesn't work well with gentle, flowing, or meditative moods

**Compatible Moods**: aggressive, triumphant, tense, solemn
**Incompatible Moods**: cheerful, playful, meditative, mournful, eerie, tender

### 1.4 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components

### 1.5 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/play-ostinato-on-instrument-action.spec.md` - Ostinato action (similar pattern)
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `specs/wcag-compliant-color-combinations.spec.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/drive_accent_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:drive_accent_on_instrument",
  "name": "Drive Accent on Instrument",
  "description": "Drive a sharp, emphatic accent on the instrument you are currently playing. This technique works best with forceful, intense, or emphatic moods.",
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
          ["aggressive", "triumphant", "tense", "solemn"]
        ]
      },
      "failure_message": "Driving accents requires forceful moods. Try aggressive, triumphant, tense, or solemn performance styles."
    }
  ],
  "template": "drive an accent on {instrument}",
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
- Actor cannot attempt accent on instruments they're not currently playing
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
- Compatible moods: `aggressive`, `triumphant`, `tense`, `solemn` (subset of ostinato's moods)
- Provides player-friendly failure message when mood is incompatible

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

### 2.3 Prerequisite Logic Explanation

The prerequisite validates that the actor's current performance mood supports emphatic accents:

```json
{
  "in": [
    {"var": "actor.components.music:performance_mood.mood"},
    ["aggressive", "triumphant", "tense", "solemn"]
  ]
}
```

This JSON Logic expression:
1. Retrieves the `mood` property from the actor's `music:performance_mood` component
2. Checks if the mood value is present in the array of compatible moods
3. Returns `true` if compatible, `false` if incompatible
4. If `false`, the action is filtered out during discovery and the failure message is logged

**Mood Rationale**:
- **aggressive**: Sharp, driving accents fit aggressive performance
- **triumphant**: Bold, emphatic accents enhance triumphant moments
- **tense**: Insistent accents add to tense atmosphere
- **solemn**: Grave, measured accents work in solemn contexts

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-drive-accent-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-drive-accent-on-instrument",
  "description": "Evaluates to true when the event is an attempt to drive an accent on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:drive_accent_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_drive_accent_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_drive_accent_on_instrument",
  "comment": "Handles driving an emphatic accent on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-drive-accent-on-instrument"
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
      "comment": "Retrieve mood descriptors from lexicon, specifically the adjective form for accent message",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adj": "sharp" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} drives a {context.moodDescriptor.adj} accent on the {context.instrumentName}."
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
4. **Lexicon Lookup**: Retrieve mood **adjective** (the `adj` field) from `music:mood_lexicon` using the current mood as key
5. **Message Composition**: Build perceptible event message using format: `{actor} drives a {mood_adj} accent on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Examples

Based on compatible performance moods (using `adj` field from mood_lexicon):

| Mood | Adjective | Message |
|------|-----------|---------|
| **aggressive** | hard-edged | "Draven drives a hard-edged accent on the electric guitar." |
| **triumphant** | bold | "Marcus drives a bold accent on the grand organ." |
| **tense** | tight | "Kael drives a tight accent on the war drums." |
| **solemn** | grave | "Elara drives a grave accent on the cello." |

**Note**: The following moods are **not compatible** and will cause the action to be filtered during discovery:
- cheerful (bright)
- playful (teasing)
- meditative (calm)
- mournful (aching)
- eerie (unsettling)
- tender (soft)

### 4.4 Key Differences from Ostinato Action

| Aspect | Ostinato | Drive Accent |
|--------|----------|--------------|
| **Lexicon Field** | Uses `noun` field | Uses `adj` field |
| **Message Verb** | "locks into" | "drives" |
| **Compatible Moods** | 6 moods (tense, cheerful, aggressive, playful, meditative, solemn) | 4 moods (aggressive, triumphant, tense, solemn) |
| **Musical Focus** | Repetitive patterns | Emphatic moments |
| **Fallback Value** | `{ "noun": "rhythmic" }` | `{ "adj": "sharp" }` |

## 5. Mod Manifest Update

**File**: `data/mods/music/mod-manifest.json` (update)

Add the following entries to the appropriate sections:

```json
{
  "content": {
    "actions": [
      "drive_accent_on_instrument.action.json"
    ],
    "rules": [
      "handle_drive_accent_on_instrument.rule.json"
    ],
    "conditions": [
      "event-is-action-drive-accent-on-instrument.condition.json"
    ]
  }
}
```

**Note**: The `instrument_actor_is_playing.scope` already exists from the `play_phrase_on_instrument` action, so no scope updates are needed.

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/driveAccentOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/driveAccentOnInstrumentRuleExecution.test.js`

### 6.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/driveAccentOnInstrumentActionDiscovery.test.js`

The test suite should follow the pattern established by `playOstinatoOnInstrumentActionDiscovery.test.js` with the following test categories:

#### Test Categories

**1. Action structure validation**
- Verify action file structure and metadata
- Verify target scope configuration
- Verify required components for actor and primary
- Verify prerequisites array with mood validation
- Verify visual styling matches music theme

**2. Discovery with compatible moods**
- Test discovery with each of the 4 compatible moods:
  - `aggressive`
  - `triumphant`
  - `tense`
  - `solemn`
- Each mood should result in the action being discovered

**3. Discovery with incompatible moods**
- Test discovery with each of the 6 incompatible moods:
  - `cheerful`
  - `playful`
  - `meditative`
  - `mournful`
  - `eerie`
  - `tender`
- Each mood should result in the action NOT being discovered

**4. Discovery when actor lacks required components**
- Test when actor lacks `music:is_musician` component
- Test when actor lacks `music:playing_music` component
- Test when actor lacks `music:performance_mood` component
- All cases should result in action NOT being discovered

**5. Scope resolution edge cases**
- Test when `playing_music.playing_on` references non-existent instrument
- Should return empty scope (action not discovered)

#### Test Implementation Pattern

```javascript
/**
 * @file Integration tests for music:drive_accent_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import driveAccentAction from '../../../../data/mods/music/actions/drive_accent_on_instrument.action.json' assert { type: 'json' };

describe('music:drive_accent_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:drive_accent_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(driveAccentAction).toBeDefined();
      expect(driveAccentAction.id).toBe('music:drive_accent_on_instrument');
      expect(driveAccentAction.name).toBe('Drive Accent on Instrument');
      expect(driveAccentAction.description).toContain('emphatic accent');
      expect(driveAccentAction.template).toBe('drive an accent on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(driveAccentAction.targets).toBeDefined();
      expect(driveAccentAction.targets.primary).toBeDefined();
      expect(driveAccentAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(driveAccentAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(driveAccentAction.required_components).toBeDefined();
      expect(driveAccentAction.required_components.actor).toBeDefined();
      expect(driveAccentAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(driveAccentAction.required_components.primary).toBeDefined();
      expect(driveAccentAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(driveAccentAction.prerequisites).toBeDefined();
      expect(Array.isArray(driveAccentAction.prerequisites)).toBe(true);
      expect(driveAccentAction.prerequisites.length).toBe(1);
      expect(driveAccentAction.prerequisites[0].logic).toBeDefined();
      expect(driveAccentAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(driveAccentAction.visual).toBeDefined();
      expect(driveAccentAction.visual.backgroundColor).toBe('#1a2332');
      expect(driveAccentAction.visual.textColor).toBe('#d1d5db');
      expect(driveAccentAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(driveAccentAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = ['aggressive', 'triumphant', 'tense', 'solemn'];

    compatibleMoods.forEach((mood) => {
      it(`should discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Performer')
          .atLocation('concert_hall')
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
        testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const accentActions = discoveredActions.filter(
          (action) => action.id === 'music:drive_accent_on_instrument'
        );

        expect(accentActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = ['cheerful', 'playful', 'meditative', 'mournful', 'eerie', 'tender'];

    incompatibleMoods.forEach((mood) => {
      it(`should NOT discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Performer')
          .atLocation('concert_hall')
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
        testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const accentActions = discoveredActions.filter(
          (action) => action.id === 'music:drive_accent_on_instrument'
        );

        expect(accentActions.length).toBe(0);
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
          playing_on: 'instrument1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('instrument1')
        .withName('instrument')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const accentActions = discoveredActions.filter(
        (action) => action.id === 'music:drive_accent_on_instrument'
      );

      expect(accentActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('instrument1')
        .withName('instrument')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const accentActions = discoveredActions.filter(
        (action) => action.id === 'music:drive_accent_on_instrument'
      );

      expect(accentActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks performance_mood component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Moodless Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'instrument1',
        })
        .build();

      const instrument = new ModEntityBuilder('instrument1')
        .withName('instrument')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const accentActions = discoveredActions.filter(
        (action) => action.id === 'music:drive_accent_on_instrument'
      );

      expect(accentActions.length).toBe(0);
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
          mood: 'aggressive',
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

**File**: `tests/integration/mods/music/driveAccentOnInstrumentRuleExecution.test.js`

The test suite should follow the pattern established by `playOstinatoOnInstrumentRuleExecution.test.js` with the following test categories:

#### Test Categories

**1. Successfully executes drive_accent_on_instrument action**
- Verify perceptible event dispatched with mood-adjective-flavored message
- Verify action success event dispatched
- Test all 4 compatible moods with correct adjectives:
  - `aggressive` → `hard-edged`
  - `triumphant` → `bold`
  - `tense` → `tight`
  - `solemn` → `grave`
- Verify fallback adjective when mood not found in lexicon

**2. Edge cases and validation**
- Test multiple sequential accent performances
- Verify locationId included in perceptible event
- Verify targetId included in perceptible event

#### Test Implementation Pattern

```javascript
/**
 * @file Integration tests for handle_drive_accent_on_instrument rule execution.
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
import driveAccentRule from '../../../../data/mods/music/rules/handle_drive_accent_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionDriveAccent from '../../../../data/mods/music/conditions/event-is-action-drive-accent-on-instrument.condition.json' assert { type: 'json' };

describe('music:drive_accent_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:drive_accent_on_instrument',
      driveAccentRule,
      eventIsActionDriveAccent
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes drive_accent_on_instrument action', () => {
    it('should dispatch perceptible event with mood-adjective-flavored message', async () => {
      const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Draven')
        .atLocation('concert_hall')
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
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'aggressive', the adj is 'hard-edged'
      expect(perceptibleEvent.payload.descriptionText).toContain('Draven');
      expect(perceptibleEvent.payload.descriptionText).toContain('hard-edged');
      expect(perceptibleEvent.payload.descriptionText).toContain('accent');
      expect(perceptibleEvent.payload.descriptionText).toContain('electric guitar');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/drives a.*accent on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'organ1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('organ1')
        .withName('grand organ')
        .atLocation('hall')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'organ1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 4 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'aggressive', expectedAdj: 'hard-edged' },
        { mood: 'triumphant', expectedAdj: 'bold' },
        { mood: 'tense', expectedAdj: 'tight' },
        { mood: 'solemn', expectedAdj: 'grave' },
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
        expect(perceptibleEvent.payload.descriptionText).toContain('accent');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback adjective when mood not found in lexicon', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Musician')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'instrument1',
        })
        .withComponent('music:performance_mood', {
          mood: 'nonexistent_mood',
        })
        .build();

      const instrument = new ModEntityBuilder('instrument1')
        .withName('instrument')
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
      // Should use the fallback value from missing_value parameter
      expect(perceptibleEvent.payload.descriptionText).toContain('sharp');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential accent performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
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
        .withName('drums')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First accent
      await testFixture.executeAction('musician1', 'drums1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second accent
      await testFixture.executeAction('musician1', 'drums1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('tight');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'cello1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('cello1')
        .withName('cello')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'cello1');

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
          playing_on: 'trumpet1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('trumpet1')
        .withName('trumpet')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'trumpet1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('trumpet1');
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

```bash
# Run action discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/driveAccentOnInstrumentActionDiscovery.test.js --no-coverage --silent

# Run rule execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/driveAccentOnInstrumentRuleExecution.test.js --no-coverage --silent

# Run all music mod tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent
```

## 7. File Structure Summary

```
data/mods/music/
├── actions/
│   └── drive_accent_on_instrument.action.json            [NEW]
├── rules/
│   └── handle_drive_accent_on_instrument.rule.json       [NEW]
├── conditions/
│   └── event-is-action-drive-accent-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                      [UPDATE]

tests/integration/mods/music/
├── driveAccentOnInstrumentActionDiscovery.test.js        [NEW]
└── driveAccentOnInstrumentRuleExecution.test.js          [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify `music:instrument_actor_is_playing` scope exists (from play_phrase_on_instrument action)
- [ ] Verify `music:mood_lexicon` lookup exists with `adj` field for all moods
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Action Definition

- [ ] Create `data/mods/music/actions/drive_accent_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Verify prerequisite logic correctly checks mood compatibility (4 moods only)
- [ ] Update `data/mods/music/mod-manifest.json` to include action file

### 8.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_drive_accent_on_instrument.rule.json`
- [ ] Verify rule uses `adj` field from mood_lexicon (not `noun` or `adjectives`)
- [ ] Verify message format: "{actor} drives a {mood_adj} accent on the {primary}."
- [ ] Verify fallback value is `{ "adj": "sharp" }`
- [ ] Update mod manifest to include rule file

### 8.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-drive-accent-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.5 Testing - Action Discovery

- [ ] Create `tests/integration/mods/music/driveAccentOnInstrumentActionDiscovery.test.js`
- [ ] Implement action structure validation tests (6 tests)
- [ ] Implement compatible mood tests (4 moods: aggressive, triumphant, tense, solemn)
- [ ] Implement incompatible mood tests (6 moods: cheerful, playful, meditative, mournful, eerie, tender)
- [ ] Implement missing component tests (3 tests)
- [ ] Implement scope resolution edge case tests (1 test)
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/driveAccentOnInstrumentActionDiscovery.test.js --no-coverage --silent`
- [ ] Verify all tests pass

### 8.6 Testing - Rule Execution

- [ ] Create `tests/integration/mods/music/driveAccentOnInstrumentRuleExecution.test.js`
- [ ] Implement perceptible event message test with mood adjective
- [ ] Implement action success event test
- [ ] Implement all 4 compatible moods test with correct adjectives
- [ ] Implement fallback adjective test
- [ ] Implement sequential performance test
- [ ] Implement locationId inclusion test
- [ ] Implement targetId inclusion test
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/driveAccentOnInstrumentRuleExecution.test.js --no-coverage --silent`
- [ ] Verify all tests pass

### 8.7 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds (≥80% branches, ≥90% functions/lines)

### 8.8 Documentation

- [ ] Update music mod documentation with drive accent action
- [ ] Document prerequisite pattern for mood-based actions
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `drive_accent_on_instrument` action is defined and discoverable
2. ✅ Action only appears when actor has compatible mood (aggressive, triumphant, tense, solemn)
3. ✅ Action does NOT appear when actor has incompatible mood (cheerful, playful, meditative, mournful, eerie, tender)
4. ✅ Prerequisite validation provides helpful failure message
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood **adjective** (not noun) from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} drives a {mood_adj} accent on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass (including all 10 mood scenarios)
10. ✅ All rule execution tests pass (including all 4 compatible mood adjective validations)
11. ✅ Test coverage meets 80%+ thresholds
12. ✅ No schema validation errors
13. ✅ No linting errors
14. ✅ No type checking errors

## 10. Design Decisions

### 10.1 Why Restrict to 4 Moods Only?

**Decision**: Use JSON Logic prerequisites to restrict accent to 4 forceful moods (aggressive, triumphant, tense, solemn).

**Rationale**:
- **Musical Authenticity**: Accents are emphatic techniques requiring forceful delivery
- **Focused Palette**: Narrower mood selection creates clear use cases
- **Complementary to Ostinato**: Ostinato supports 6 moods; accent supports a focused subset
- **Gameplay Depth**: Players choose between techniques based on emotional intensity needs

**Why Exclude Certain Moods**:
- **cheerful/playful**: Too light for emphatic accents
- **meditative**: Conflicts with accent's sharp, emphatic nature
- **mournful/eerie/tender**: Require gentler, flowing expression

### 10.2 Why Use the Adjective Field from Lexicon?

**Decision**: Use the `adj` field from mood_lexicon rather than `noun` or `adjectives`.

**Rationale**:
- **Grammatical Correctness**: "drives a {adjective} accent" reads naturally
- **Distinct from Ostinato**: Differentiates accent from ostinato (which uses `noun`)
- **Concise Descriptors**: Single adjectives provide crisp, emphatic descriptions
- **Lexicon Flexibility**: Demonstrates multiple uses of the mood_lexicon lookup

**Example Messages**:
- "drives a **hard-edged** accent" (aggressive)
- "drives a **bold** accent" (triumphant)
- "drives a **tight** accent" (tense)
- "drives a **grave** accent" (solemn)

### 10.3 Why Reuse Existing Scope?

**Decision**: Use the existing `music:instrument_actor_is_playing` scope.

**Rationale**:
- **Code Reuse**: Scope already exists and works correctly
- **Consistency**: All music technique actions target the currently-played instrument
- **Maintainability**: Single scope definition for related actions
- **Performance**: No additional scope registration or resolution overhead

### 10.4 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Consistency**: Matches pattern from `play_phrase_on_instrument` and `play_ostinato_on_instrument` actions

### 10.5 Why Use "drives" Instead of Other Verbs?

**Decision**: Use "drives" as the action verb in messages.

**Rationale**:
- **Musical Accuracy**: "Driving an accent" is standard musical terminology
- **Conveys Force**: The verb "drives" suggests forceful, emphatic action
- **Complements "locks into"**: Different verb from ostinato's "locks into" distinguishes the techniques
- **Active Voice**: Maintains consistency with other action messages

## 11. Future Enhancements

### 11.1 Accent Duration and Decay

Add component to track accent effects:
- `music:accent_resonating` component with duration/intensity
- Gradually fading narrative mentions
- Influences subsequent musical actions

### 11.2 Multiple Accent Types

Customize accent types per instrument category:
- Percussion: Rim shots, cross-stick accents
- Strings: Sforzando, marcato
- Brass: Staccato, accent with tonguing
- Keys: Forte-piano, accent with pedal

### 11.3 Combo Actions

Create compound actions combining accents with other techniques:
- Accent-then-ostinato sequences
- Accent on phrase endings
- Accent as crescendo peak

### 11.4 Dynamic Expression Integration

Link accents to broader dynamic system:
- Accents affect overall volume level
- Integration with crescendo/diminuendo
- Accent strength based on musician skill

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/play-ostinato-on-instrument-action.spec.md` - Similar pattern using `noun` field
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview
- `data/schemas/action.schema.json` - Action schema with prerequisite definitions

### 12.3 Reference Files

- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup
- `data/mods/music/actions/play_ostinato_on_instrument.action.json` - Similar action pattern (uses `noun`)
- `data/mods/music/actions/play_phrase_on_instrument.action.json` - General music action pattern
- `data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json` - Similar rule pattern
- `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-06
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "drive accent on instrument" action to the Living Narrative Engine music mod. The design prioritizes musical authenticity, mood-based prerequisites, comprehensive testing, and consistency with existing music mod patterns while providing a distinct technique focused on emphatic, forceful musical expression._
