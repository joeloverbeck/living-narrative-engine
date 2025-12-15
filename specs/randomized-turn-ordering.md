# Randomized Turn Ordering Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-15
**Author:** System Architect
**Dependencies:** `core` mod (v1.0.0+)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Problem Statement](#problem-statement)
3. [Architecture Goals](#architecture-goals)
4. [Configuration Design](#configuration-design)
5. [Algorithm Design](#algorithm-design)
6. [Component Architecture](#component-architecture)
7. [Integration Points](#integration-points)
8. [Testing Strategy](#testing-strategy)
9. [Implementation Phases](#implementation-phases)
10. [Edge Cases](#edge-cases)
11. [Future Extensions](#future-extensions)

---

## System Overview

### Purpose

The randomized turn ordering system introduces configurable randomization of NPC (non-human) actor turn order each round while maintaining fixed positions for human players. This creates more dynamic and unpredictable gameplay interactions without disrupting player agency.

### Key Features

- **Position-Preserving Shuffle**: Human players maintain their fixed queue positions from the world definition
- **Non-Human Randomization**: AI/LLM actors are shuffled among remaining queue slots each round
- **Configurable Behavior**: Enable/disable randomization via configuration file
- **Strategy-Specific**: Different shuffle behaviors for different turn order strategies
- **Testable**: Seeded random number generator support for deterministic testing

### Design Philosophy

1. **Data-Driven Configuration**: Shuffle behavior controlled through config files, not hardcoded
2. **Non-Breaking**: Feature can be disabled to preserve original behavior
3. **Testable First**: Seeded random support enables deterministic unit tests
4. **ECS-Compatible**: Works with existing Entity Component System architecture
5. **Single Responsibility**: Dedicated service for shuffle logic

---

## Problem Statement

### Current Behavior

Currently, turn order is fixed based on the order characters appear in the world definition file (e.g., `dredgers.world.json`). Characters declared earlier in the world file always act before others in the round.

### Issues with Current Behavior

1. **Predictable Interactions**: The same character always acts before another, creating artificial patterns
2. **Unrealistic Dynamics**: Real social/combat scenarios have more variability in who acts when
3. **Reduced Emergent Behavior**: Fixed ordering limits the variety of narrative situations that can emerge
4. **Player Advantage/Disadvantage**: Human player position is arbitrary based on file order

### Desired Behavior

1. Non-human actors should have their turn order randomized each round
2. Human players should maintain fixed positions (as defined in world file order)
3. The behavior should be configurable (enable/disable)
4. The system should be testable with deterministic results

---

## Architecture Goals

### Primary Goals

1. **Preserve Human Position**: Human players always act in their world-file-defined order position
2. **Randomize Non-Humans**: AI/LLM actors are shuffled among remaining slots each round
3. **Configurable**: Master switch and per-strategy settings in config file
4. **Backward Compatible**: Disable flag preserves original deterministic behavior
5. **Performance Efficient**: O(n) shuffle algorithm for any party size

### Integration Points

```
World Definition (*.world.json)
    |
    v
RoundManager.startRound()
    |
    v
TurnOrderShuffleService.applyPositionPreservingShuffle() <-- New Service
    |
    v
TurnOrderService.startNewRound()
    |
    v
SimpleRoundRobinQueue / InitiativePriorityQueue
```

### Data Flow

```
Actors Array (from RoundManager)
    |
    v
Human Detection (core:player_type component check)
    |
    v
Position-Preserving Shuffle Algorithm
    |
    v
Reordered Actors Array
    |
    v
Queue Population (existing flow)
```

---

## Configuration Design

### Config File Location

`src/turns/config/turnOrderShuffle.config.js`

### Configuration Schema

```javascript
export const turnOrderShuffleConfig = {
  // Master enable/disable for shuffle feature
  enabled: true,

  // Strategy-specific settings
  strategies: {
    'round-robin': {
      // Shuffle non-human actors in round-robin mode
      shuffleNonHumans: true,
    },
    'initiative': {
      // For initiative strategy: shuffle only when breaking ties
      // (Future enhancement - initiative already has natural ordering)
      shuffleTieBreakers: false,
    },
  },

  // Player type detection settings
  playerTypeDetection: {
    // Component to check for player type
    componentId: 'core:player_type',
    // Value indicating human player
    humanTypeValue: 'human',
  },

  // Debugging/logging options
  diagnostics: {
    // Log the shuffle results to debug output
    logShuffleResults: false,
    // Log the original order before shuffling
    logOriginalOrder: false,
  },

  // Environment-specific overrides
  environments: {
    development: {
      diagnostics: {
        logShuffleResults: true,
        logOriginalOrder: true,
      },
    },
    test: {
      // Keep shuffle enabled in tests
      enabled: true,
    },
    production: {
      diagnostics: {
        logShuffleResults: false,
        logOriginalOrder: false,
      },
    },
  },
};
```

### Configuration Functions

```javascript
// Get merged configuration for current environment
export function getTurnOrderShuffleConfig();

// Check if shuffle is enabled for a given strategy
export function isShuffleEnabledForStrategy(strategy);
```

---

## Algorithm Design

### Position-Preserving Shuffle Algorithm

**Input**: Array of actors in world file order
**Output**: Array with humans at fixed positions, non-humans shuffled

#### Pseudocode

```
function positionPreservingShuffle(actors):
    // Step 1: Identify fixed positions (human players)
    fixedPositions = Map()
    shuffleableActors = []

    for i = 0 to actors.length - 1:
        if isHumanPlayer(actors[i]):
            fixedPositions.set(i, actors[i])
        else:
            shuffleableActors.push(actors[i])

    // Step 2: Shuffle non-humans using Fisher-Yates
    shuffledNonHumans = fisherYatesShuffle(shuffleableActors)

    // Step 3: Rebuild array with fixed positions preserved
    result = new Array(actors.length)
    shuffledIndex = 0

    for i = 0 to actors.length - 1:
        if fixedPositions.has(i):
            result[i] = fixedPositions.get(i)
        else:
            result[i] = shuffledNonHumans[shuffledIndex++]

    return result
```

### Example Walkthrough

**Input**: `[Human1, NPC1, NPC2, Human2, NPC3]` (5 actors)

1. **Identify fixed positions**:
   - Index 0: Human1 (fixed)
   - Index 3: Human2 (fixed)
   - Shuffleable: [NPC1, NPC2, NPC3]

2. **Shuffle non-humans** (example random result): `[NPC3, NPC1, NPC2]`

3. **Rebuild array**:
   - Index 0: Human1 (fixed)
   - Index 1: NPC3 (from shuffled[0])
   - Index 2: NPC1 (from shuffled[1])
   - Index 3: Human2 (fixed)
   - Index 4: NPC2 (from shuffled[2])

**Output**: `[Human1, NPC3, NPC1, Human2, NPC2]`

### Fisher-Yates Shuffle (Knuth Shuffle)

```javascript
function fisherYatesShuffle(array, randomFn = Math.random):
    for i = array.length - 1 down to 1:
        j = floor(randomFn() * (i + 1))
        swap(array[i], array[j])
    return array
```

**Complexity**: O(n) time, O(1) additional space

---

## Component Architecture

### New Files

#### 1. `src/utils/shuffleUtils.js`

General-purpose shuffle utilities with seeded random support.

```javascript
/**
 * Fisher-Yates shuffle (in-place)
 * @param {Array} array - Array to shuffle
 * @param {function(): number} [randomFn] - Random function (default: Math.random)
 * @returns {Array} The shuffled array (same reference)
 */
export function shuffleInPlace(array, randomFn = Math.random);

/**
 * Creates a new shuffled copy of an array
 * @param {Array} array - Array to shuffle
 * @param {function(): number} [randomFn] - Random function
 * @returns {Array} New shuffled array
 */
export function shuffle(array, randomFn = Math.random);

/**
 * Creates a seeded random number generator for deterministic testing
 * @param {number} seed - Seed value
 * @returns {function(): number} Seeded random function
 */
export function createSeededRandom(seed);
```

#### 2. `src/turns/config/turnOrderShuffle.config.js`

Configuration file following project patterns.

#### 3. `src/turns/services/turnOrderShuffleService.js`

Service implementing the position-preserving shuffle.

```javascript
/**
 * @class TurnOrderShuffleService
 * @description Applies position-preserving shuffle to turn order actors.
 */
export class TurnOrderShuffleService {
  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger service
   * @param {function(): number} [deps.randomFn] - Optional random function for testing
   */
  constructor({ logger, randomFn = Math.random });

  /**
   * Applies position-preserving shuffle to actors array
   * @param {Entity[]} actors - Original actor array in world file order
   * @param {string} strategy - Turn order strategy ('round-robin' or 'initiative')
   * @returns {Entity[]} Shuffled actor array with preserved human positions
   */
  applyPositionPreservingShuffle(actors, strategy);
}
```

### Modified Files

#### 1. `src/turns/order/turnOrderService.js`

**Changes**:
- Accept optional `shuffleService` in constructor
- Call `shuffleService.applyPositionPreservingShuffle()` in `startNewRound()` before queue population

```javascript
// Constructor addition
constructor({ logger, shuffleService = null }) {
  // ... existing validation ...
  this.#shuffleService = shuffleService;
}

// startNewRound modification
startNewRound(entities, strategy, initiativeData) {
  // ... existing validation ...

  // Apply position-preserving shuffle if service is available
  let processedEntities = entities;
  if (this.#shuffleService && strategy === 'round-robin') {
    processedEntities = this.#shuffleService.applyPositionPreservingShuffle(
      entities,
      strategy
    );
  }

  // ... rest of method using processedEntities ...
}
```

#### 2. `src/dependencyInjection/tokens/tokens-core.js`

**Addition**:
```javascript
ITurnOrderShuffleService: 'ITurnOrderShuffleService',
```

#### 3. `src/dependencyInjection/registrations/turnLifecycleRegistrations.js`

**Additions**:
```javascript
import TurnOrderShuffleService from '../../turns/services/turnOrderShuffleService.js';

// Register shuffle service
registrar.singletonFactory(
  tokens.ITurnOrderShuffleService,
  (c) => new TurnOrderShuffleService({
    logger: c.resolve(tokens.ILogger)
  })
);

// Modify ITurnOrderService registration to inject shuffle service
registrar.singletonFactory(
  tokens.ITurnOrderService,
  (c) => new TurnOrderService({
    logger: c.resolve(tokens.ILogger),
    shuffleService: c.resolve(tokens.ITurnOrderShuffleService)
  })
);
```

---

## Integration Points

### Human Player Detection

Human players are identified by the `core:player_type` component:

```json
{
  "core:player_type": {
    "type": "human"
  }
}
```

Non-human (AI/LLM) actors have:

```json
{
  "core:player_type": {
    "type": "llm"
  }
}
```

### Turn Order Flow Integration

```
Before (current flow):
RoundManager → TurnOrderService.startNewRound(actors) → Queue

After (new flow):
RoundManager → TurnOrderService.startNewRound(actors)
             → TurnOrderShuffleService.applyPositionPreservingShuffle()
             → Queue (with reordered actors)
```

### Event Flow

No changes to event flow. The `core:round_started` event will contain the shuffled actor order:

```javascript
{
  type: 'core:round_started',
  payload: {
    roundNumber: 1,
    actors: ['human1', 'npc3', 'npc1', 'human2', 'npc2'], // Shuffled order
    strategy: 'round-robin'
  }
}
```

---

## Testing Strategy

### Unit Tests

#### `tests/unit/utils/shuffleUtils.test.js`

```javascript
describe('shuffleUtils', () => {
  describe('shuffleInPlace', () => {
    it('should shuffle array in place');
    it('should return same array reference');
    it('should handle empty array');
    it('should handle single element array');
    it('should produce different results with different random functions');
    it('should preserve all original elements');
  });

  describe('shuffle', () => {
    it('should return new array');
    it('should not modify original array');
    it('should contain all original elements');
  });

  describe('createSeededRandom', () => {
    it('should produce deterministic sequence with same seed');
    it('should produce different sequences with different seeds');
    it('should return values in [0, 1) range');
  });
});
```

#### `tests/unit/turns/services/turnOrderShuffleService.test.js`

```javascript
describe('TurnOrderShuffleService', () => {
  describe('constructor', () => {
    it('should validate logger dependency');
    it('should accept optional randomFn');
  });

  describe('applyPositionPreservingShuffle', () => {
    // Core functionality
    it('should preserve human player positions');
    it('should shuffle non-human actors among remaining slots');
    it('should produce deterministic results with seeded random');

    // Config behavior
    it('should return original if shuffle disabled');
    it('should respect strategy-specific settings');

    // Edge cases
    it('should return original for empty array');
    it('should return original for single actor');
    it('should handle all humans (no shuffling needed)');
    it('should handle all non-humans (full shuffle)');
    it('should handle human at first position only');
    it('should handle human at last position only');
    it('should handle multiple humans interspersed');

    // Entity handling
    it('should handle actors without player_type component');
    it('should handle actors with missing components gracefully');
  });
});
```

#### `tests/unit/turns/config/turnOrderShuffle.config.test.js`

```javascript
describe('turnOrderShuffle.config', () => {
  describe('getTurnOrderShuffleConfig', () => {
    it('should return base config');
    it('should merge environment config');
    it('should return defaults for unknown environment');
  });

  describe('isShuffleEnabledForStrategy', () => {
    it('should return true for round-robin when enabled');
    it('should return false for initiative by default');
    it('should return false when master switch disabled');
    it('should return false for unknown strategy');
  });
});
```

### Integration Tests

#### `tests/integration/turns/order/turnOrderShuffle.integration.test.js`

```javascript
describe('Turn Order Shuffle Integration', () => {
  it('should shuffle NPCs while preserving human positions in full round lifecycle');
  it('should respect config disabled state');
  it('should work with DI container setup');
  it('should produce different orders on subsequent rounds');
  it('should emit round_started event with shuffled order');
  it('should integrate with turn ticker renderer display');
});
```

### Test Coverage Requirements

| Component | Branches | Functions | Lines |
|-----------|----------|-----------|-------|
| shuffleUtils.js | 100% | 100% | 100% |
| turnOrderShuffleService.js | 90%+ | 100% | 95%+ |
| turnOrderShuffle.config.js | 85%+ | 100% | 90%+ |

---

## Implementation Phases

### Phase 1: Foundation (No breaking changes)

1. Create `src/utils/shuffleUtils.js` with tests
2. Create `src/turns/config/turnOrderShuffle.config.js` with tests

**Verification**: All new tests pass, no existing tests affected

### Phase 2: Service Implementation

3. Create `src/turns/services/turnOrderShuffleService.js` with tests
4. Add DI token for `ITurnOrderShuffleService`

**Verification**: Service tests pass, can be instantiated independently

### Phase 3: Integration

5. Register `TurnOrderShuffleService` in DI container
6. Modify `TurnOrderService` constructor to accept shuffle service
7. Modify `TurnOrderService.startNewRound()` to apply shuffle
8. Update existing tests if needed

**Verification**: Integration tests pass, existing turn order tests still pass

### Phase 4: Validation

9. Run full test suite
10. Manual testing with human + NPC scenarios
11. Verify config enable/disable works correctly

**Verification**: All tests pass, manual testing confirms expected behavior

---

## Edge Cases

### 1. All Actors Are Human

- **Scenario**: World file contains only human players
- **Expected**: No shuffling occurs, original order preserved
- **Verification**: Fixed positions map contains all indices, shuffleable array is empty

### 2. All Actors Are Non-Human

- **Scenario**: World file contains only AI/LLM actors
- **Expected**: Full shuffle of all actors
- **Verification**: Fixed positions map is empty, all actors shuffled

### 3. Single Actor

- **Scenario**: Only one actor in the game
- **Expected**: No shuffling needed, return original array
- **Verification**: Early return when actors.length <= 1

### 4. Empty Actor Array

- **Scenario**: Round starts with no actors
- **Expected**: Return empty array without error
- **Verification**: Handle gracefully, return input unchanged

### 5. Actors Without `player_type` Component

- **Scenario**: Legacy entities without component
- **Expected**: Treat as non-human (shuffleable)
- **Verification**: Missing component = shuffleable default

### 6. Config Disabled Mid-Game

- **Scenario**: Config is modified during gameplay
- **Expected**: Changes take effect on next round start
- **Verification**: Config is read fresh each round

### 7. Multiple Rounds

- **Scenario**: Multiple rounds in sequence
- **Expected**: Different shuffle results each round (unless seeded)
- **Verification**: Randomness persists across rounds

---

## Future Extensions

### Out of Scope for Initial Implementation

1. **Initiative Tie-Breaking**: Shuffle actors with equal initiative scores
2. **Player Position Preference**: Allow human players to choose preferred queue position
3. **Weighted Shuffle**: Give certain NPC types higher probability of early positions
4. **Persist Shuffle State**: Save/restore shuffle results for game saves
5. **Per-Actor Override**: Individual actors opt-out of shuffling via component flag
6. **Faction-Based Grouping**: Keep faction members adjacent in queue

---

## Appendix: Related Files

### Existing Files for Reference

- `src/turns/order/turnOrderService.js` - Main service to modify
- `src/turns/roundManager.js` - Calls startNewRound with actors
- `src/turns/order/queues/simpleRoundRobinQueue.js` - FIFO queue implementation
- `src/config/actionPipelineConfig.js` - Config pattern reference
- `src/dependencyInjection/tokens/tokens-core.js` - DI tokens
- `src/dependencyInjection/registrations/turnLifecycleRegistrations.js` - Turn service registrations

### Test File Reference

- `tests/unit/turns/turnOrder/turnOrderService.startNewRound.roundRobin.test.js` - Existing tests to verify
- `tests/integration/turns/order/turnOrderService.roundRobin.integration.test.js` - Integration test patterns
