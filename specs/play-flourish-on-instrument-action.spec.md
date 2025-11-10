# Play Flourish on Instrument Action Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-06
**Version**: 1.0.0
**Author**: Living Narrative Engine Team

## 1. Overview

### 1.1 Executive Summary

This specification defines an action and rule for the `music` mod that allows musicians to perform a **flourish** - a showy, ornamental musical embellishment - on the instrument they are currently playing. Unlike the ostinato action which is best suited for driving, rhythmic moods, the flourish action is restricted to expressive, dynamic moods that support showy, ornamental musical gestures.

### 1.2 Motivation

Building on the music action ecosystem defined in `specs/music-mod.spec.md` and `specs/play-ostinato-on-instrument-action.spec.md`, this feature provides:

1. **Musical Archetype Specificity**: Flourish is a distinct musical technique requiring expressive, dynamic moods
2. **Complementary Mood Coverage**: Flourishes work best with playful, triumphant, cheerful, and tender moods - complementing the ostinato action's mood set
3. **Expressive Depth**: Provides a specialized ornamental technique for showy musical moments
4. **Prerequisite Pattern Consistency**: Follows established pattern for mood-based action filtering

### 1.3 Musical Context: Flourish

A **flourish** is a showy ornamental passage or embellishment in music. It is characterized by:

- **Ornamental Nature**: Brief decorative passage that showcases technique
- **Expressive Quality**: Works best with dynamic, emotionally expressive moods
- **Display Element**: Often used to punctuate or emphasize musical moments
- **Mood Compatibility**: Works best with playful, triumphant, cheerful, or tender moods

**Compatible Moods**: playful, triumphant, cheerful, tender
**Incompatible Moods**: tense, aggressive, meditative, solemn, mournful, eerie

### 1.4 Dependencies

- **music mod** (^1.0.0) - Provides core components (`is_musician`, `is_instrument`, `playing_music`, `performance_mood`)
- **items mod** (^1.0.0) - Provides item components
- **core mod** (^1.0.0) - Provides event system, rule macros, and base components
- **positioning mod** (^1.0.0) - Provides `doing_complex_performance` component (optional)

### 1.5 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon lookup
- `specs/play-ostinato-on-instrument-action.spec.md` - Reference pattern for mood-restricted actions
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system infrastructure
- `docs/mods/mod-color-schemes.md` - Visual identity for music mod

## 2. Action Definition

### 2.1 Action Structure

**File**: `data/mods/music/actions/play_flourish_on_instrument.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "music:play_flourish_on_instrument",
  "name": "Play Flourish on Instrument",
  "description": "Execute a showy ornamental flourish on the instrument you are currently playing. This technique works best with playful, triumphant, cheerful, or tender moods.",
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
          ["playful", "triumphant", "cheerful", "tender"]
        ]
      },
      "failure_message": "Flourishes don't work well with your current performance mood. Try a mood that's more playful, triumphant, cheerful, or tender."
    }
  ],
  "template": "play flourish on {instrument}",
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
- Actor cannot attempt flourish on instruments they're not currently playing
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
- Compatible moods: `playful`, `triumphant`, `cheerful`, `tender`
- Provides player-friendly failure message when mood is incompatible

**Visual Identity**: Uses Starlight Navy color scheme (Section 11.4 of `wcag-compliant-color-combinations.spec.md`), consistent with all music mod actions.

### 2.3 Prerequisite Logic Explanation

The prerequisite validates that the actor's current performance mood is compatible with flourish:

```json
{
  "in": [
    {"var": "actor.components.music:performance_mood.mood"},
    ["playful", "triumphant", "cheerful", "tender"]
  ]
}
```

This JSON Logic expression:
1. Retrieves the `mood` property from the actor's `music:performance_mood` component
2. Checks if the mood value is present in the array of compatible moods
3. Returns `true` if compatible, `false` if incompatible
4. If `false`, the action is filtered out during discovery and the failure message is logged

## 3. Condition Definition

**File**: `data/mods/music/conditions/event-is-action-play-flourish-on-instrument.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "music:event-is-action-play-flourish-on-instrument",
  "description": "Evaluates to true when the event is an attempt to play a flourish on an instrument",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "music:play_flourish_on_instrument"
    ]
  }
}
```

**Note**: Condition filename uses **hyphens** per mod file naming conventions documented in `docs/testing/mod-testing-guide.md`.

## 4. Rule Definition

### 4.1 Rule Structure

**File**: `data/mods/music/rules/handle_play_flourish_on_instrument.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_play_flourish_on_instrument",
  "comment": "Handles playing a flourish (showy ornamental embellishment) on the currently-played instrument, using the actor's current performance mood to flavor the narrative description.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "music:event-is-action-play-flourish-on-instrument"
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
      "comment": "Retrieve mood descriptors from lexicon, specifically the adjective form for flourish message",
      "parameters": {
        "lookup_id": "music:mood_lexicon",
        "entry_key": "{context.performanceMood.mood}",
        "result_variable": "moodDescriptor",
        "missing_value": { "adj": "flashy" }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Compose perceptible event message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} flashes a {context.moodDescriptor.adj} flourish on the {context.instrumentName}."
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
5. **Message Composition**: Build perceptible event message using format: `{actor} flashes a {mood_adj} flourish on the {instrument}.`
6. **Event Variables**: Set required variables for the `core:logSuccessAndEndTurn` macro
7. **Success Dispatch**: Use macro to dispatch perceptible event, success message, and end turn

### 4.3 Message Examples

Based on compatible performance moods (using `adj` field from mood_lexicon):

| Mood | Adjective | Message |
|------|-----------|---------|
| **playful** | teasing | "Felix flashes a teasing flourish on the silver flute." |
| **triumphant** | bold | "Marcus flashes a bold flourish on the brass trumpet." |
| **cheerful** | bright | "Lyra flashes a bright flourish on the silver lute." |
| **tender** | soft | "Zara flashes a soft flourish on the wooden harp." |

**Note**: The following moods are **not compatible** and will cause the action to be filtered during discovery:
- tense (tight)
- aggressive (hard-edged)
- meditative (calm)
- solemn (grave)
- mournful (aching)
- eerie (unsettling)

## 5. Mod Manifest Update

**File**: `data/mods/music/mod-manifest.json` (update)

Add the following entries to the appropriate sections:

```json
{
  "content": {
    "actions": [
      "play_flourish_on_instrument.action.json"
    ],
    "rules": [
      "handle_play_flourish_on_instrument.rule.json"
    ],
    "conditions": [
      "event-is-action-play-flourish-on-instrument.condition.json"
    ]
  }
}
```

**Note**: The `instrument_actor_is_playing.scope` and `mood_lexicon.lookup.json` already exist from previous music actions, so no updates to those resources are needed.

## 6. Testing Strategy

### 6.1 Test File Organization

**Action Discovery Test**:
`tests/integration/mods/music/playFlourishOnInstrumentActionDiscovery.test.js`

**Rule Execution Test**:
`tests/integration/mods/music/playFlourishOnInstrumentRuleExecution.test.js`

### 6.2 Action Discovery Test Structure

**File**: `tests/integration/mods/music/playFlourishOnInstrumentActionDiscovery.test.js`

The test file should follow the ModTestFixture pattern documented in `docs/testing/mod-testing-guide.md` and include the following test suites:

#### 6.2.1 Test Suite: Action Structure Validation

**Purpose**: Verify the action JSON file is correctly structured and contains all required fields.

**Test Cases**:
1. **should have correct action structure**
   - Verify action is defined
   - Verify ID is `music:play_flourish_on_instrument`
   - Verify name is `Play Flourish on Instrument`
   - Verify description contains "flourish" and "ornamental"
   - Verify template is `play flourish on {instrument}`

2. **should use instrument_actor_is_playing scope for primary target**
   - Verify targets.primary.scope is `music:instrument_actor_is_playing`
   - Verify targets.primary.placeholder is `instrument`

3. **should require is_musician, playing_music, and performance_mood components on actor**
   - Verify required_components.actor contains:
     - `music:is_musician`
     - `music:playing_music`
     - `music:performance_mood`

4. **should require items:item and music:is_instrument components on primary target**
   - Verify required_components.primary contains:
     - `items:item`
     - `music:is_instrument`

5. **should have prerequisites array with mood validation**
   - Verify prerequisites array exists and has length 1
   - Verify prerequisites[0].logic is defined
   - Verify prerequisites[0].failure_message is defined

6. **should have correct visual styling matching music theme**
   - Verify backgroundColor is `#1a2332`
   - Verify textColor is `#d1d5db`
   - Verify hoverBackgroundColor is `#2d3748`
   - Verify hoverTextColor is `#f3f4f6`

#### 6.2.2 Test Suite: Discovery with Compatible Moods

**Purpose**: Verify action is discoverable when actor has any of the 4 compatible moods.

**Compatible Moods**: `playful`, `triumphant`, `cheerful`, `tender`

**Test Cases** (parameterized for each mood):
- **should discover action when actor has {mood} mood**
  - Create room entity
  - Create musician with `music:is_musician`, `music:playing_music` (playing_on: instrument), `music:performance_mood` (mood: {mood})
  - Create instrument with `items:item`, `music:is_instrument`
  - Reset fixture with entities
  - Build action index with flourish action
  - Discover actions for musician
  - Assert flourish action is discovered (length = 1)

#### 6.2.3 Test Suite: Discovery with Incompatible Moods

**Purpose**: Verify action is NOT discoverable when actor has incompatible moods.

**Incompatible Moods**: `tense`, `aggressive`, `meditative`, `solemn`, `mournful`, `eerie`

**Test Cases** (parameterized for each mood):
- **should NOT discover action when actor has {mood} mood**
  - Create room entity
  - Create musician with all required components but incompatible mood
  - Create instrument
  - Reset fixture with entities
  - Build action index with flourish action
  - Discover actions for musician
  - Assert flourish action is NOT discovered (length = 0)

#### 6.2.4 Test Suite: Discovery when Actor Lacks Required Components

**Purpose**: Verify action is NOT discoverable when actor is missing required components.

**Test Cases**:
1. **should NOT discover action when actor lacks is_musician component**
   - Create actor without `music:is_musician`
   - Verify action not discovered

2. **should NOT discover action when actor lacks playing_music component**
   - Create actor without `music:playing_music`
   - Verify action not discovered

3. **should NOT discover action when actor lacks performance_mood component**
   - Create actor without `music:performance_mood`
   - Verify action not discovered

#### 6.2.5 Test Suite: Scope Resolution Edge Cases

**Purpose**: Verify scope resolution behaves correctly in edge cases.

**Test Cases**:
1. **should return empty scope when playing_music references non-existent instrument**
   - Create musician with `playing_on` referencing non-existent entity
   - Resolve scope manually using unifiedScopeResolver
   - Verify scope.success is true
   - Verify scope.value is empty array

### 6.3 Rule Execution Test Structure

**File**: `tests/integration/mods/music/playFlourishOnInstrumentRuleExecution.test.js`

The test file should follow the ModTestFixture pattern and include the following test suites:

#### 6.3.1 Test Suite: Successfully Executes play_flourish_on_instrument Action

**Purpose**: Verify the rule correctly executes and generates expected events and messages.

**Test Cases**:
1. **should dispatch perceptible event with mood-adjective-flavored message**
   - Create room, musician (with playful mood), and instrument
   - Execute action via fixture.executeAction
   - Filter events for `core:perceptible_event`
   - Verify perceptible event exists
   - Verify message contains actor name
   - Verify message contains mood adjective (e.g., "teasing" for playful)
   - Verify message contains "flourish"
   - Verify message contains instrument name
   - Verify message matches pattern: /flashes a.*flourish on/

2. **should dispatch action success event**
   - Create room, musician, and instrument
   - Execute action
   - Use custom matcher: `expect(testFixture.events).toHaveActionSuccess()`

3. **should work with all 4 compatible moods from mood_lexicon**
   - Parameterized test for moods:
     - `{ mood: 'playful', expectedAdj: 'teasing' }`
     - `{ mood: 'triumphant', expectedAdj: 'bold' }`
     - `{ mood: 'cheerful', expectedAdj: 'bright' }`
     - `{ mood: 'tender', expectedAdj: 'soft' }`
   - For each mood:
     - Create entities with specific mood
     - Execute action
     - Verify perceptible event contains expected adjective
     - Verify message contains "flourish"
     - Clear events for next iteration

4. **should use fallback adjective when mood not found in lexicon**
   - Create musician with non-existent mood (e.g., "nonexistent_mood")
   - Execute action
   - Verify perceptible event message contains fallback value "flashy"

#### 6.3.2 Test Suite: Edge Cases and Validation

**Purpose**: Verify rule handles edge cases and includes all required event metadata.

**Test Cases**:
1. **should handle multiple sequential flourish performances correctly**
   - Execute flourish action twice sequentially
   - Verify both executions succeed
   - Verify perceptible events are dispatched for both

2. **should include locationId in perceptible event**
   - Create room with specific ID (e.g., "grand_hall")
   - Execute action
   - Verify perceptible event payload.locationId matches room ID

3. **should include targetId in perceptible event**
   - Create instrument with specific ID
   - Execute action
   - Verify perceptible event payload.targetId matches instrument ID

### 6.4 Test Coverage Requirements

- **Action Discovery**: ≥80% coverage for action discovery logic
- **Prerequisite Validation**: 100% coverage for all 4 compatible and 6 incompatible moods
- **Rule Execution**: ≥80% coverage for rule operation sequence
- **Integration**: Full workflow tests covering all 4 compatible moods
- **Edge Cases**: Comprehensive coverage of fallback behavior and metadata

### 6.5 Test Execution Commands

**Action Discovery Test**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playFlourishOnInstrumentActionDiscovery.test.js --no-coverage --silent
```

**Rule Execution Test**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playFlourishOnInstrumentRuleExecution.test.js --no-coverage --silent
```

**Full Music Mod Test Suite**:
```bash
NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent
```

### 6.6 Testing Best Practices

Based on `docs/testing/mod-testing-guide.md`:

1. **Use ModTestFixture.forAction()**: Create fixtures using the recommended factory method
2. **Import Domain Matchers**: Use `import '../../../common/mods/domainMatchers.js'` for custom matchers
3. **Import Action Matchers**: Use `import '../../../common/actionMatchers.js'` for action success assertions
4. **Use ModEntityBuilder**: Build test entities with fluent API
5. **Use ModEntityScenarios**: Leverage scenario helpers like `createRoom()`
6. **Clean Up**: Always call `testFixture.cleanup()` in `afterEach` blocks
7. **Import JSON Files**: Import action/rule/condition JSON files for structure validation tests
8. **Test File Naming**: Use camelCase with descriptor (e.g., `playFlourishOnInstrumentActionDiscovery.test.js`)

## 7. File Structure Summary

```
data/mods/music/
├── actions/
│   └── play_flourish_on_instrument.action.json            [NEW]
├── rules/
│   └── handle_play_flourish_on_instrument.rule.json       [NEW]
├── conditions/
│   └── event-is-action-play-flourish-on-instrument.condition.json  [NEW]
└── mod-manifest.json                                      [UPDATE]

tests/integration/mods/music/
├── playFlourishOnInstrumentActionDiscovery.test.js        [NEW]
└── playFlourishOnInstrumentRuleExecution.test.js          [NEW]
```

## 8. Implementation Checklist

### 8.1 Prerequisites

- [ ] Verify music mod component infrastructure is implemented (per `specs/music-mod.spec.md`)
- [ ] Verify `music:instrument_actor_is_playing` scope exists
- [ ] Verify `music:mood_lexicon` lookup exists with `adj` field for all moods
- [ ] Verify QUERY_LOOKUP operation handler is implemented

### 8.2 Action Definition

- [ ] Create `data/mods/music/actions/play_flourish_on_instrument.action.json`
- [ ] Verify action uses Starlight Navy visual scheme
- [ ] Verify prerequisite logic correctly checks mood compatibility (playful, triumphant, cheerful, tender)
- [ ] Update `data/mods/music/mod-manifest.json` to include action file

### 8.3 Rule Definition

- [ ] Create `data/mods/music/rules/handle_play_flourish_on_instrument.rule.json`
- [ ] Verify rule uses `adj` field from mood_lexicon (not `noun` or `adjectives`)
- [ ] Update mod manifest to include rule file

### 8.4 Condition Definition

- [ ] Create `data/mods/music/conditions/event-is-action-play-flourish-on-instrument.condition.json`
- [ ] Verify condition file uses hyphens (not underscores) in filename
- [ ] Update mod manifest to include condition file

### 8.5 Testing - Action Discovery

- [ ] Create `tests/integration/mods/music/playFlourishOnInstrumentActionDiscovery.test.js`
- [ ] Implement "Action structure validation" test suite
- [ ] Implement "Discovery with compatible moods" test suite (4 moods: playful, triumphant, cheerful, tender)
- [ ] Implement "Discovery with incompatible moods" test suite (6 moods: tense, aggressive, meditative, solemn, mournful, eerie)
- [ ] Implement "Discovery when actor lacks required components" test suite
- [ ] Implement "Scope resolution edge cases" test suite
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playFlourishOnInstrumentActionDiscovery.test.js --no-coverage --silent`
- [ ] Verify all test cases pass

### 8.6 Testing - Rule Execution

- [ ] Create `tests/integration/mods/music/playFlourishOnInstrumentRuleExecution.test.js`
- [ ] Implement "Successfully executes play_flourish_on_instrument action" test suite
  - [ ] Test perceptible event with mood-adjective message
  - [ ] Test action success event dispatch
  - [ ] Test all 4 compatible moods with correct adjectives
  - [ ] Test fallback adjective for unknown mood
- [ ] Implement "Edge cases and validation" test suite
  - [ ] Test multiple sequential flourish performances
  - [ ] Test locationId in perceptible event
  - [ ] Test targetId in perceptible event
- [ ] Run test: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/playFlourishOnInstrumentRuleExecution.test.js --no-coverage --silent`
- [ ] Verify all test cases pass

### 8.7 Full Test Suite Validation

- [ ] Run all music mod tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/music/ --silent`
- [ ] Verify no regression in existing music mod tests
- [ ] Verify test coverage meets 80%+ thresholds

### 8.8 Code Quality Validation

- [ ] Run schema validation: `npm run validate`
- [ ] Run linting on modified files: `npx eslint data/mods/music/`
- [ ] Run linting on test files: `npx eslint tests/integration/mods/music/playFlourishOnInstrument*.test.js`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run full test suite: `npm run test:ci`

### 8.9 Documentation

- [ ] Update music mod documentation with flourish action
- [ ] Document complementary relationship between flourish (expressive) and ostinato (rhythmic)
- [ ] Add example usage to mod documentation

## 9. Acceptance Criteria

1. ✅ `play_flourish_on_instrument` action is defined and discoverable
2. ✅ Action only appears when actor has compatible mood (playful, triumphant, cheerful, tender)
3. ✅ Action does NOT appear when actor has incompatible mood (tense, aggressive, meditative, solemn, mournful, eerie)
4. ✅ Prerequisite validation provides helpful failure message
5. ✅ Rule retrieves current mood from `performance_mood` component
6. ✅ Rule looks up mood adjective from `music:mood_lexicon`
7. ✅ Perceptible event message follows format: `{actor} flashes a {mood_adj} flourish on the {primary}.`
8. ✅ Success message is displayed correctly
9. ✅ All action discovery tests pass (including all 10 mood scenarios: 4 compatible + 6 incompatible)
10. ✅ All rule execution tests pass (including all 4 compatible moods)
11. ✅ Test coverage meets 80%+ thresholds
12. ✅ No schema validation errors
13. ✅ No linting errors
14. ✅ No type checking errors
15. ✅ No regression in existing music mod tests

## 10. Design Decisions

### 10.1 Why Restrict to Specific Moods?

**Decision**: Use JSON Logic prerequisites to restrict flourish to 4 expressive moods.

**Rationale**:
- **Musical Authenticity**: Flourishes are ornamental embellishments that work best with expressive, dynamic moods
- **Complementary Coverage**: Flourish moods complement ostinato moods, providing coverage across the full mood spectrum
- **Gameplay Depth**: Creates meaningful choices - players must consider mood when choosing techniques
- **Pattern Consistency**: Follows established prerequisite pattern from ostinato action

### 10.2 Why Use the Adjective Field from Lexicon?

**Decision**: Use the `adj` field from mood_lexicon rather than `noun` or `adjectives`.

**Rationale**:
- **Grammatical Correctness**: "flashes a {adj} flourish" reads naturally in English
- **Distinct from Other Actions**: Ostinato uses `noun`, phrase uses various fields - adjective differentiates flourish
- **Lexicon Flexibility**: Demonstrates primary adjective usage from mood_lexicon
- **Narrative Variety**: Provides different descriptive words than other music actions

### 10.3 Why "Flashes" as the Action Verb?

**Decision**: Use "flashes" in the message template rather than "plays" or "performs".

**Rationale**:
- **Showy Nature**: "Flashes" emphasizes the ornamental, display-oriented nature of flourishes
- **Quick Execution**: Flourishes are brief embellishments, not sustained patterns like ostinato
- **Narrative Distinctiveness**: Creates clear differentiation from other musical actions
- **Musical Vocabulary**: "Flashing a flourish" is authentic musical terminology

### 10.4 Why Complementary Moods to Ostinato?

**Decision**: Choose 4 moods that complement (rather than overlap with) ostinato's 6 moods.

**Rationale**:
- **Complete Coverage**: Together, ostinato and flourish cover all 10 moods in mood_lexicon
- **Clear Differentiation**: Players understand when to use each technique based on mood
- **Musical Logic**: Ostinato suits rhythmic/driving moods; flourish suits expressive/dynamic moods
- **Design Clarity**: No overlap prevents confusion about which action to choose

### 10.5 Why No Component Modifications?

**Decision**: Rule does not add, remove, or modify any components.

**Rationale**:
- **Performance State Preservation**: Maintains existing `playing_music` and `performance_mood`
- **Idempotent Action**: Can be repeated without state accumulation
- **Simplicity**: Focuses solely on expressive narrative output
- **Consistency**: Matches pattern from other music performance actions

## 11. Future Enhancements

### 11.1 Flourish Complexity Levels

Introduce skill-based flourish variations:
- Simple flourish (default)
- Double flourish (advanced)
- Cadenza flourish (expert)

### 11.2 Instrument-Specific Flourishes

Customize flourish types per instrument:
- Strings: Arpeggio flourishes
- Brass: Fanfare flourishes
- Percussion: Roll flourishes
- Winds: Trill flourishes

### 11.3 Flourish Combo System

Chain multiple flourishes together:
- Track consecutive flourish performances
- Special narrative descriptions for flourish chains
- Mood-appropriate flourish progression

### 11.4 Flourish Intensity

Add intensity parameter to flourish:
- Subtle flourish (tender, soft moods)
- Moderate flourish (default)
- Grand flourish (triumphant, bold moods)

## 12. References

### 12.1 Related Specifications

- `specs/music-mod.spec.md` - Core music component definitions
- `specs/music-mood-setting-actions.spec.md` - Mood-setting actions and mood_lexicon
- `specs/play-ostinato-on-instrument-action.spec.md` - Complementary mood-restricted action
- `specs/play-phrase-on-instrument-action.spec.md` - General phrase-playing action
- `specs/lookups-content-type-infrastructure.spec.md` - Lookup system

### 12.2 Related Documentation

- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content (PRIMARY REFERENCE)
- `CLAUDE.md` - Project architecture overview
- `data/schemas/action.schema.json` - Action schema with prerequisite definitions

### 12.3 Reference Files

**Actions**:
- `data/mods/music/actions/play_ostinato_on_instrument.action.json` - Similar mood-restricted pattern
- `data/mods/music/actions/play_phrase_on_instrument.action.json` - General music action pattern

**Rules**:
- `data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json` - Similar rule pattern with QUERY_LOOKUP

**Scopes & Lookups**:
- `data/mods/music/scopes/instrument_actor_is_playing.scope` - Scope used by this action
- `data/mods/music/lookups/mood_lexicon.lookup.json` - Mood descriptor lookup (adj field)

**Tests**:
- `tests/integration/mods/music/playOstinatoOnInstrumentActionDiscovery.test.js` - Discovery test reference
- `tests/integration/mods/music/playOstinatoOnInstrumentRuleExecution.test.js` - Execution test reference
- `tests/integration/mods/music/playPhraseOnInstrumentActionDiscovery.test.js` - Alternative discovery pattern
- `tests/integration/mods/music/playPhraseOnInstrumentRuleExecution.test.js` - Alternative execution pattern

### 12.4 Testing Utilities

- `tests/common/mods/ModTestFixture.js` - Main fixture factory
- `tests/common/mods/ModEntityBuilder.js` - Entity builder and scenario helpers
- `tests/common/mods/domainMatchers.js` - Custom Jest matchers for domain assertions
- `tests/common/actionMatchers.js` - Custom Jest matchers for action success

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-06
**Version**: 1.0.0

_This specification provides a complete implementation plan for adding the "play flourish on instrument" action to the Living Narrative Engine music mod. The design prioritizes musical authenticity, complementary mood coverage with the ostinato action, and comprehensive testing while maintaining consistency with existing music mod patterns._
