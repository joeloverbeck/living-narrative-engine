# Swell Music on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-06
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to perform a **swell** - a crescendo or accent that rises dramatically in intensity - on the instrument they are currently playing. This technique is restricted to specific performance moods that are compatible with swelling as a musical technique.

### 1.2 Motivation

Building on the music performance actions defined in the music mod, this feature provides:

1. **Dynamic Musical Expression**: Swelling is a fundamental technique for creating dramatic moments
2. **Mood-Based Gameplay Constraints**: Only moods that support dramatic rises work with swells
3. **Expressive Depth**: Provides a specialized musical technique for building intensity
4. **Prerequisite Pattern Consistency**: Demonstrates JSON Logic prerequisites for component property validation

### 1.3 Musical Context: Swelling

A **swell** (or crescendo accent) is a musical technique where volume and intensity increase dramatically. It is characterized by:

- **Dynamic Rise**: Gradual or sudden increase in intensity leading to a peak
- **Mood Compatibility**: Works best with moods that support dramatic expression
- **Incompatibility**: Doesn't work well with moods that require restraint or stability

**Compatible Moods**: triumphant, tense, mournful, tender, meditative
**Incompatible Moods**: cheerful, aggressive, playful, solemn, eerie

### 1.4 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components

### 1.5 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/play-ostinato-on-instrument-action.spec.md` - Ostinato performance action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `specs/wcag-compliant-color-combinations.spec.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/swell_music_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:swell_music_on_instrument",
  "name": "Swell Music on Instrument",
  "description": "Drive an accent that rises dramatically in intensity on the instrument you are currently playing. This technique creates powerful dramatic moments and works with moods that support expressive rises.",
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
          ["triumphant", "tense", "mournful", "tender", "meditative"]
        ]
      },
      "failure_message": "Swelling requires a mood that supports dramatic rises. Try a mood that's more expressive or emotionally dynamic."
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
- Actor cannot attempt a swell on instruments they're not currently playing
- Scope resolution fails gracefully if actor stops playing

**Required Components**: Identical to other music performance actions:
- **Actor Requirements**:
  - `music:is_musician` - Must be a trained musician
  - `music:playing_music` - Must be actively playing an instrument
  - `music:performance_mood` - Must have an established performance mood
- **Primary Requirements**:
  - `items:item` - Target must be a valid item entity
  - `music:is_instrument` - Target must be a recognized instrument

**Prerequisites**: JSON Logic validation checking mood compatibility:
- Uses `in` operator to check if `performance_mood.mood` is in the compatible list
- Compatible moods: `triumphant`, `tense`, `mournful`, `tender`, `meditative`
- Provides player-friendly failure message when mood is incompatible

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

### 2.3 Prerequisite Logic Explanation

The prerequisite validates that the actor's current performance mood is compatible with swelling:

```json
{
  "in": [
    {"var": "actor.components.music:performance_mood.mood"},
    ["triumphant", "tense", "mournful", "tender", "meditative"]
  ]
}
```

This JSON Logic expression:
1. Retrieves the `mood` property from the actor's `music:performance_mood` component
2. Checks if the mood value is present in the array of compatible moods
3. Returns `true` if compatible, `false` if incompatible
4. If `false`, the action is filtered out during discovery and the failure message is logged

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-swell-music-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-swell-music-on-instrument",
  "description": "Evaluates to true when the event is an attempt to swell music on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:swell_music_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_swell_music_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_swell_music_on_instrument",
  "comment": "Handles swelling music (creating a dramatic crescendo accent) on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-swell-music-on-instrument"
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
      "comment": "Retrieve mood descriptors from lexicon, specifically the adjective form for swell message",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adj": "dynamic" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} swells into a {context.moodDescriptor.adj} rise on the {context.instrumentName}."
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
5. **Message Composition**: Build perceptible event message using format: `{actor} swells into a {mood_adj} rise on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Examples

Based on compatible performance moods (using `adj` field from mood_lexicon):

| Mood | Adjective | Message |
|------|-----------|---------|
| **triumphant** | bold | "Kael swells into a bold rise on the brass horn." |
| **tense** | tight | "Lyra swells into a tight rise on the violin." |
| **mournful** | aching | "Elara swells into an aching rise on the cello." |
| **tender** | soft | "Marcus swells into a soft rise on the acoustic guitar." |
| **meditative** | calm | "Zara swells into a calm rise on the chimes." |

**Note**: The following moods are **not compatible** and will cause the action to be filtered during discovery:
- cheerful (bright)
- aggressive (hard-edged)
- playful (teasing)
- solemn (grave)
- eerie (unsettling)

## 5. Mod Manifest Update

**File**: `data/mods/music/mod-manifest.json` (update)

Add the following entries to the appropriate sections:

```json
{
  "content": {
    "actions": [
      "swell_music_on_instrument.action.json"
    ],
    "rules": [
      "handle_swell_music_on_instrument.rule.json"
    ],
    "conditions": [
      "event-is-action-swell-music-on-instrument.condition.json"
    ]
  }
}
```

**Note**: The `instrument_actor_is_playing.scope` already exists from other music actions, so no scope updates are needed.

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/swellMusicOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/swellMusicOnInstrumentRuleExecution.test.js`

### 6.2 Action Discovery Test Requirements

The action discovery test must verify:

1. **Action Structure Validation**:
   - Correct action ID, name, description, template
   - Correct primary target scope (`music:instrument_actor_is_playing`)
   - Required components match specification
   - Prerequisites array with mood validation
   - Visual styling matches music theme (Starlight Navy)

2. **Discovery with Compatible Moods**:
   - Test all 5 compatible moods: `triumphant`, `tense`, `mournful`, `tender`, `meditative`
   - Action should be discovered for each compatible mood
   - Use `ModTestFixture.forAction()` pattern

3. **Discovery with Incompatible Moods**:
   - Test all 5 incompatible moods: `cheerful`, `aggressive`, `playful`, `solemn`, `eerie`
   - Action should NOT be discovered for each incompatible mood

4. **Discovery with Missing Components**:
   - Actor lacks `music:is_musician` → No discovery
   - Actor lacks `music:playing_music` → No discovery
   - Actor lacks `music:performance_mood` → No discovery

5. **Scope Resolution Edge Cases**:
   - `playing_music` references non-existent instrument → Empty scope

### 6.3 Rule Execution Test Requirements

The rule execution test must verify:

1. **Successful Execution**:
   - Dispatches perceptible event with mood-adjective-flavored message
   - Message format: `{actor} swells into a {mood_adj} rise on the {instrument}.`
   - Dispatches action success event

2. **All Compatible Moods**:
   - Test all 5 compatible moods with expected adjectives:
     - `triumphant` → "bold"
     - `tense` → "tight"
     - `mournful` → "aching"
     - `tender` → "soft"
     - `meditative` → "calm"

3. **Fallback Handling**:
   - When mood not found in lexicon, use fallback adjective "dynamic"

4. **Event Metadata**:
   - Perceptible event includes `locationId`
   - Perceptible event includes `targetId`
   - Correct perception type: `action_target_general`

5. **Sequential Executions**:
   - Multiple swell performances work correctly
   - Events are properly cleared between executions

### 6.4 Test Pattern Reference

Tests should follow the established pattern from `playOstinatoOnInstrumentActionDiscovery.test.js` and `playOstinatoOnInstrumentRuleExecution.test.js`:

- Use `ModTestFixture.forAction()` for test setup
- Use `ModEntityBuilder` for entity creation
- Use `ModEntityScenarios.createRoom()` for location setup
- Import domain matchers: `import '../../../common/mods/domainMatchers.js'`
- Import action matchers: `import '../../../common/actionMatchers.js'`
- Use `testFixture.cleanup()` in `afterEach`
- Use `testFixture.executeAction()` for rule tests
- Use `testFixture.discoverActions()` for discovery tests

### 6.5 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Prerequisite Validation**: 100% coverage for all 5 compatible and 5 incompatible moods
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Integration**: Full workflow tests covering all 5 compatible moods

## 7. File Structure Summary

```
data/mods/music/
├── actions/
│   └── swell_music_on_instrument.action.json                [NEW]
├── rules/
│   └── handle_swell_music_on_instrument.rule.json           [NEW]
├── conditions/
│   └── event-is-action-swell-music-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                        [UPDATE]

tests/integration/mods/music/
├── swellMusicOnInstrumentActionDiscovery.test.js            [NEW]
└── swellMusicOnInstrumentRuleExecution.test.js              [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify `music:instrument_actor_is_playing` scope exists
- [ ] Verify `music:mood_lexicon` lookup exists with `adj` field for all moods
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Action Definition

- [ ] Create `data/mods/music/actions/swell_music_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Verify prerequisite logic correctly checks mood compatibility
- [ ] Update `data/mods/music/mod-manifest.json` to include action file

### 8.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_swell_music_on_instrument.rule.json`
- [ ] Verify rule uses `adj` field from mood_lexicon (not `noun` or `adjectives`)
- [ ] Update mod manifest to include rule file

### 8.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-swell-music-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.5 Testing

**Action Discovery Test**:
- [ ] Create `tests/integration/mods/music/swellMusicOnInstrumentActionDiscovery.test.js`
- [ ] Verify tests cover all 5 compatible moods
- [ ] Verify tests cover all 5 incompatible moods
- [ ] Verify tests cover missing component scenarios
- [ ] Verify tests cover scope resolution edge cases
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/swellMusicOnInstrumentActionDiscovery.test.js --no-coverage --silent`

**Rule Execution Test**:
- [ ] Create `tests/integration/mods/music/swellMusicOnInstrumentRuleExecution.test.js`
- [ ] Verify tests cover all 5 compatible moods with correct adjectives
- [ ] Verify tests cover fallback handling
- [ ] Verify tests cover event metadata (locationId, targetId)
- [ ] Verify tests cover sequential executions
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/swellMusicOnInstrumentRuleExecution.test.js --no-coverage --silent`

**Full Test Suite**:
- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`

### 8.6 Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify test coverage meets thresholds

### 8.7 Documentation

- [ ] Update music mod documentation with swell action
- [ ] Document prerequisite pattern for mood-based actions
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `swell_music_on_instrument` action is defined and discoverable
2. ✅ Action only appears when actor has compatible mood (triumphant, tense, mournful, tender, meditative)
3. ✅ Action does NOT appear when actor has incompatible mood (cheerful, aggressive, playful, solemn, eerie)
4. ✅ Prerequisite validation provides helpful failure message
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood adjective from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} swells into a {mood_adj} rise on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass (including all 10 mood scenarios)
10. ✅ All rule execution tests pass
11. ✅ Test coverage meets 80%+ thresholds
12. ✅ No schema validation errors
13. ✅ No linting errors
14. ✅ No type checking errors

## 10. Design Decisions

### 10.1 Why These Specific Moods?

**Decision**: Use JSON Logic prerequisites to restrict swelling to 5 specific moods.

**Rationale**:
- **Musical Authenticity**: Swelling creates dramatic rises, which work with expressive and emotionally dynamic moods
- **Complementary to Ostinato**: Different mood set than ostinato, providing strategic choices
- **Gameplay Depth**: Players must consider which technique fits their current mood
- **Pattern Consistency**: Showcases prerequisite system for component property validation

### 10.2 Why Use the Adjective Field from Lexicon?

**Decision**: Use the `adj` field from mood_lexicon rather than `noun` or `adjectives`.

**Rationale**:
- **Grammatical Correctness**: "swells into a {adjective} rise" reads naturally
- **Distinct from Ostinato**: Differentiates swell from ostinato (which uses `noun`)
- **Distinct from Phrase**: Differentiates swell from phrase-playing (which uses `adjectives`)
- **Lexicon Flexibility**: Demonstrates multiple uses of the mood_lexicon lookup
- **Narrative Variety**: Provides different descriptive words than other actions

### 10.3 Why Reuse Existing Scope?

**Decision**: Use the existing `music:instrument_actor_is_playing` scope.

**Rationale**:
- **Code Reuse**: Scope already exists and works correctly
- **Consistency**: All performance actions target the currently-played instrument
- **Maintainability**: Single scope definition for related actions
- **Performance**: No additional scope registration or resolution overhead

### 10.4 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Consistency**: Matches pattern from other music performance actions

### 10.5 Why "drive an accent" Template?

**Decision**: Use "drive an accent on {instrument}" as the action template.

**Rationale**:
- **Musical Terminology**: "Accent" is the correct term for emphasized musical moments
- **Distinct from Other Actions**: Clear differentiation from "play phrase" and "play ostinato"
- **Concise**: Short, clear template that fits UI constraints
- **Player-Friendly**: Understandable to non-musicians

## 11. Future Enhancements

### 11.1 Sustained Swell Tracking

Add component to track swell duration:
- `music:performing_swell` component with peak intensity
- Duration affects subsequent actions
- Long swells have special narrative effects

### 11.2 Mood-Specific Swell Variations

Customize swell types per mood:
- Triumphant: Heroic, ringing crescendos
- Mournful: Aching, emotional builds
- Tense: Anxious, gripping rises
- Tender: Gentle, warm crescendos
- Meditative: Serene, flowing swells

### 11.3 Swell Intensity Levels

Introduce skill-based intensity:
- Gentle swell (default)
- Dramatic swell (advanced)
- Overwhelming swell (expert)

### 11.4 Release from Swell Action

Add complementary action to resolve swell:
- `release_swell` action
- Transitions from peak back to baseline
- Narrative acknowledgment of tension release

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/play-ostinato-on-instrument-action.spec.md` - Ostinato performance action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview
- `data/schemas/action.schema.json` - Action schema with prerequisite definitions

### 12.3 Reference Files

- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup
- `data/mods/music/actions/play_ostinato_on_instrument.action.json` - Similar action pattern
- `data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json` - Similar rule pattern
- `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js` - Execution test reference

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-06
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "swell music on instrument" action to the Living Narrative Engine music mod. The design prioritizes musical authenticity, prerequisite validation, and comprehensive testing while maintaining consistency with existing music mod patterns._
