# Stop Playing Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-05
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to stop playing an instrument they are currently performing on. This action complements the existing music system by providing a clean way to end a musical performance, removing all performance-related state components from the actor.

### 1.2 Motivation

Building on the existing music mod actions (`play_phrase_on_instrument`, mood-setting actions), this feature provides:

1. **Performance Termination**: Musicians can explicitly end their performance
2. **State Cleanup**: Removes performance-related components to accurately reflect the actor's current state
3. **Natural Gameplay Flow**: Completes the performance lifecycle (start → play → stop)
4. **Narrative Consistency**: Dispatches perceptible events announcing the end of the performance

### 1.3 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component

### 1.4 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/play-phrase-on-instrument-action.spec.md` - Play phrase action (uses same scope)
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions that initiate performance
- `docs/mods/mod-color-schemes.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/stop_playing_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:stop_playing_instrument",
  "name": "Stop Playing Instrument",
  "description": "Stop playing the instrument you are currently performing on, ending the musical performance.",
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
      "music:playing_music"
    ],
    "primary": [
      "items:item",
      "music:is_instrument"
    ]
  },
  "prerequisites": [],
  "template": "stop playing {instrument}",
  "visual": {
    "backgroundColor": "#1a2332",
    "textColor": "#d1d5db",
    "hoverBackgroundColor": "#2d3748",
    "hoverTextColor": "#f3f4f6"
  }
}
```

### 2.2 Key Design Decisions

**Primary Target Scope**: Uses `music:instrument_actor_is_playing` to ensure:
- Only the currently-played instrument appears as a valid target
- Actor cannot attempt to stop playing instruments they're not currently playing
- Scope resolution fails gracefully if actor is not playing

**Required Components**:
- **Actor Requirements**:
  - `music:is_musician` - Must be a trained musician
  - `music:playing_music` - Must be actively playing an instrument
  - **Note**: Does NOT require `music:performance_mood` since the actor may have lost this component through other means
- **Primary Requirements**:
  - `items:item` - Target must be a valid item entity
  - `music:is_instrument` - Target must be a recognized instrument

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-stop-playing-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-stop-playing-instrument",
  "description": "Evaluates to true when the event is an attempt to stop playing an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:stop_playing_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_stop_playing_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_stop_playing_instrument",
  "comment": "Handles stopping performance on an instrument. Removes playing_music, performance_mood, and doing_complex_performance components to mark the end of the performance.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-stop-playing-instrument"
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
      "type": "REMOVE_COMPONENT",
      "comment": "Remove playing_music component to mark the actor as no longer playing",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "music:playing_music"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove performance_mood component since performance has ended",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "music:performance_mood"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove doing_complex_performance marker since actor is no longer performing",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:doing_complex_performance"
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "comment": "Update actor description to reflect they are no longer playing",
      "parameters": {
        "entity_ref": "actor"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} stops playing the {context.instrumentName}, and the sound dies down."
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
3. **Component Removal**: Remove three components in sequence:
   - `music:playing_music` - Marks actor as no longer playing
   - `music:performance_mood` - Removes current performance mood
   - `positioning:doing_complex_performance` - Frees actor from performance constraints
4. **Description Regeneration**: Update actor's description to reflect ended performance
5. **Message Composition**: Build perceptible event message: `{actor} stops playing the {instrument}, and the sound dies down.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Example

**Standard Stop Message**:
- "Lyra stops playing the silver lute, and the sound dies down."
- "Marcus stops playing the grand piano, and the sound dies down."
- "Elara stops playing the violin, and the sound dies down."

## 5. Testing Strategy

### 5.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/stopPlayingInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/stopPlayingInstrumentRuleExecution.test.js`

### 5.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/stopPlayingInstrumentActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for music:stop_playing_instrument action discovery.
 * @description Tests that the action is discoverable only when actor is actively playing an instrument.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import stopPlayingAction from '../../../../data/mods/music/actions/stop_playing_instrument.action.json' assert { type: 'json' };

describe('music:stop_playing_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:stop_playing_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(stopPlayingAction).toBeDefined();
      expect(stopPlayingAction.id).toBe('music:stop_playing_instrument');
      expect(stopPlayingAction.name).toBe('Stop Playing Instrument');
      expect(stopPlayingAction.description).toContain('Stop playing');
      expect(stopPlayingAction.template).toBe('stop playing {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(stopPlayingAction.targets).toBeDefined();
      expect(stopPlayingAction.targets.primary).toBeDefined();
      expect(stopPlayingAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(stopPlayingAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician and playing_music components on actor', () => {
      expect(stopPlayingAction.required_components).toBeDefined();
      expect(stopPlayingAction.required_components.actor).toBeDefined();
      expect(stopPlayingAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(stopPlayingAction.required_components.primary).toBeDefined();
      expect(stopPlayingAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(stopPlayingAction.prerequisites).toBeDefined();
      expect(Array.isArray(stopPlayingAction.prerequisites)).toBe(true);
      expect(stopPlayingAction.prerequisites).toEqual([]);
    });

    it('should have correct visual styling matching music theme', () => {
      expect(stopPlayingAction.visual).toBeDefined();
      expect(stopPlayingAction.visual.backgroundColor).toBe('#1a2332');
      expect(stopPlayingAction.visual.textColor).toBe('#d1d5db');
      expect(stopPlayingAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(stopPlayingAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery scenarios', () => {
    describe('When musician is actively playing', () => {
      it('should discover stop_playing_instrument action', () => {
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
        testFixture.testEnv.actionIndex.buildIndex([stopPlayingAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const stopActions = discoveredActions.filter(
          (action) => action.id === 'music:stop_playing_instrument'
        );

        expect(stopActions.length).toBe(1);
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

      it('should discover action even without performance_mood component', () => {
        const room = ModEntityScenarios.createRoom('hall', 'Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Bard')
          .atLocation('hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'flute1',
          })
          .build();

        const instrument = new ModEntityBuilder('flute1')
          .withName('flute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([stopPlayingAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const stopActions = discoveredActions.filter(
          (action) => action.id === 'music:stop_playing_instrument'
        );

        expect(stopActions.length).toBe(1);
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
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, nonMusician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([stopPlayingAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const stopActions = discoveredActions.filter(
          (action) => action.id === 'music:stop_playing_instrument'
        );

        expect(stopActions.length).toBe(0);
      });

      it('should NOT discover action when actor lacks playing_music component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Room');

        const musician = new ModEntityBuilder('musician1')
          .withName('Not Playing Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([stopPlayingAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const stopActions = discoveredActions.filter(
          (action) => action.id === 'music:stop_playing_instrument'
        );

        expect(stopActions.length).toBe(0);
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

### 5.3 Rule Execution Test Structure

**File**: `tests/integration/mods/music/stopPlayingInstrumentRuleExecution.test.js`

```javascript
/**
 * @file Integration tests for handle_stop_playing_instrument rule execution.
 * @description Tests that the rule correctly removes performance components and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import stopPlayingRule from '../../../../data/mods/music/rules/handle_stop_playing_instrument.rule.json' assert { type: 'json' };
import eventIsActionStopPlaying from '../../../../data/mods/music/conditions/event-is-action-stop-playing-instrument.condition.json' assert { type: 'json' };

describe('music:stop_playing_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:stop_playing_instrument',
      stopPlayingRule,
      eventIsActionStopPlaying
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes stop_playing_instrument action', () => {
    it('should remove playing_music component from actor', async () => {
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

      const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:playing_music');
    });

    it('should remove performance_mood component from actor', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('grand piano')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'piano1');

      const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:performance_mood');
    });

    it('should remove doing_complex_performance component from actor', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Elara')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'violin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'mournful',
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'violin1');

      const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('positioning:doing_complex_performance');
    });

    it('should dispatch perceptible event with correct message', async () => {
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
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Lyra stops playing the silver lute, and the sound dies down.'
      );
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

    it('should work when actor lacks performance_mood component', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Performer')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('harp')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'harp1');

      const musicianAfter = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:playing_music');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should regenerate actor description after stopping', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Musician')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drum1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('war drum')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drum1');

      const regenerateEvents = testFixture.events.filter(
        (e) => e.eventType === 'entities:description_regenerated'
      );

      expect(regenerateEvents.length).toBeGreaterThan(0);
      expect(regenerateEvents[0].payload.entityId).toBe('musician1');
    });
  });

  describe('Edge cases and validation', () => {
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
          mood: 'tense',
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

    it('should handle multiple start-stop cycles correctly', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First stop
      await testFixture.executeAction('musician1', 'violin1');
      const musicianAfterFirstStop = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfterFirstStop).not.toHaveComponent('music:playing_music');

      // Re-add components for second cycle
      testFixture.entityManager.addComponent('musician1', 'music:playing_music', {
        playing_on: 'violin1',
      });
      testFixture.entityManager.addComponent('musician1', 'music:performance_mood', {
        mood: 'cheerful',
      });
      testFixture.entityManager.addComponent('musician1', 'positioning:doing_complex_performance', {});

      testFixture.clearEvents();

      // Second stop
      await testFixture.executeAction('musician1', 'violin1');
      const musicianAfterSecondStop = testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfterSecondStop).not.toHaveComponent('music:playing_music');
      expect(testFixture.events).toHaveActionSuccess();
    });
  });
});
```

### 5.4 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Component Removal**: 100% coverage for all three component removals
- **Integration**: Full workflow tests covering various performance states

## 6. File Structure Summary

```
data/mods/music/
├── actions/
│   └── stop_playing_instrument.action.json                [NEW]
├── rules/
│   └── handle_stop_playing_instrument.rule.json           [NEW]
├── conditions/
│   └── event-is-action-stop-playing-instrument.condition.json  [NEW]
└── mod-manifest.json                                      [UPDATE]

tests/integration/mods/music/
├── stopPlayingInstrumentActionDiscovery.test.js           [NEW]
└── stopPlayingInstrumentRuleExecution.test.js             [NEW]
```

## 7. Implementation Checklist

### 7.1 Prerequisites

- [x] Verify music mod component infrastructure is implemented
- [x] Verify `music:instrument_actor_is_playing` scope exists
- [x] Verify mood-setting actions are implemented (they create the state this action removes)

### 7.2 Action Definition

- [ ] Create `data/mods/music/actions/stop_playing_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Update mod manifest to include action file

### 7.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_stop_playing_instrument.rule.json`
- [ ] Verify REMOVE_COMPONENT operations are correctly sequenced
- [ ] Verify REGENERATE_DESCRIPTION is included
- [ ] Update mod manifest to include rule file

### 7.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-stop-playing-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 7.5 Testing

**Action Discovery Test**:
- [ ] Create `tests/integration/mods/music/stopPlayingInstrumentActionDiscovery.test.js`
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/stopPlayingInstrumentActionDiscovery.test.js --no-coverage --silent`

**Rule Execution Test**:
- [ ] Create `tests/integration/mods/music/stopPlayingInstrumentRuleExecution.test.js`
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/stopPlayingInstrumentRuleExecution.test.js --no-coverage --silent`

**Full Test Suite**:
- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`

### 7.6 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds

### 7.7 Documentation

- [ ] Update music mod documentation if needed
- [ ] Add example usage scenarios
- [ ] Document component lifecycle (start → play → stop)

## 8. Acceptance Criteria

1. ✅ `stop_playing_instrument` action is defined and loads correctly
2. ✅ Action uses `music:instrument_actor_is_playing` scope
3. ✅ Action only appears when actor has `is_musician` and `playing_music` components
4. ✅ Rule removes `playing_music` component from actor
5. ✅ Rule removes `performance_mood` component from actor
6. ✅ Rule removes `doing_complex_performance` component from actor
7. ✅ Rule regenerates actor description after component removal
8. ✅ Perceptible event message follows format: `{actor} stops playing the {instrument}, and the sound dies down.`
9. ✅ Success message is displayed correctly
10. ✅ All action discovery tests pass
11. ✅ All rule execution tests pass
12. ✅ Test coverage meets 80%+ thresholds
13. ✅ No schema validation errors
14. ✅ No linting errors
15. ✅ No type checking errors

## 9. Design Decisions

### 9.1 Why Not Require performance_mood for Action Discovery?

**Decision**: Only require `playing_music` component, not `performance_mood`.

**Rationale**:
- **Robustness**: Actor may have lost `performance_mood` through other means
- **State Recovery**: Allows cleanup even in edge cases
- **Simplicity**: Fewer required components means more reliable discovery
- **Consistency**: `playing_music` is the primary indicator of performance state

### 9.2 Why Remove All Three Components?

**Decision**: Remove `playing_music`, `performance_mood`, and `doing_complex_performance`.

**Rationale**:
- **Complete State Cleanup**: Ensures actor fully transitions out of performance state
- **Consistency**: Mirrors the component additions in mood-setting actions
- **Unlocks Actions**: Removing `doing_complex_performance` allows other complex actions
- **Accurate Representation**: Actor description accurately reflects non-performing state

### 9.3 Why Use Same Scope as play_phrase_on_instrument?

**Decision**: Reuse `music:instrument_actor_is_playing` scope.

**Rationale**:
- **Consistency**: Both actions target the instrument currently being played
- **Code Reuse**: Leverages existing, well-tested scope logic
- **Logical Coherence**: "Stop playing X" and "Play phrase on X" are related operations
- **Maintenance**: Single scope definition to maintain

### 9.4 Why Include REGENERATE_DESCRIPTION?

**Decision**: Call REGENERATE_DESCRIPTION after removing components.

**Rationale**:
- **Activity System**: Components with `activityMetadata` contribute to descriptions
- **UI Consistency**: Description should reflect that actor is no longer playing
- **User Feedback**: Visual confirmation that performance has ended
- **Pattern Adherence**: Follows established pattern from other state-changing actions

## 10. Future Enhancements

### 10.1 Graceful Stop Options

Add variants for different stopping styles:
- Abrupt stop (current implementation)
- Gradual fadeout
- Dramatic ending (crescendo then stop)
- Smooth transition to silence

### 10.2 Audience Reaction

Track listener responses to performance ending:
- Applause mechanics
- Mood impact on reaction
- Performance duration tracking
- Encore requests

### 10.3 Instrument State

Add instrument-specific state after playing:
- "Recently played" component
- Warmup state for string instruments
- Tuning drift
- Maintenance needs

### 10.4 Performance Statistics

Track performance metrics:
- Duration of performance
- Phrases played
- Mood changes during performance
- Location performance history

## 11. References

### 11.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/play-phrase-on-instrument-action.spec.md` - Complementary action using same scope
- `specs/music-mood-setting-actions.spec.md` - Actions that create the state this action removes
- `docs/mods/mod-color-schemes.md` - Visual identity

### 11.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview

### 11.3 Reference Files

- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/actions/play_phrase_on_instrument.action.json` - Related action pattern
- `data/mods/music/actions/set_cheerful_mood_on_instrument.action.json` - Creates state this action removes
- `data/mods/positioning/components/doing_complex_performance.component.json` - Component removed by this action
- `tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js` - Similar test structure
- `tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js` - Similar test structure

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-05
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "stop playing instrument" action to the Living Narrative Engine music mod. The design completes the performance lifecycle (start → play → stop) and ensures proper state cleanup through systematic component removal._
