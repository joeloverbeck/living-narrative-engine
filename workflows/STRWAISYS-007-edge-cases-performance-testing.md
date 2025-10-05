# STRWAISYS-007: Edge Cases and Performance Testing

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 3-4 hours
**Dependencies:** STRWAISYS-001, STRWAISYS-002, STRWAISYS-003, STRWAISYS-004, STRWAISYS-005, STRWAISYS-006
**Blocks:** None

## Objective

Implement comprehensive edge case testing and performance validation for the straddling waist system. Verify mutual exclusivity with other positioning states, validate performance characteristics, and document future enhancement scenarios.

## Background

This final ticket ensures the straddling system is robust, performant, and properly integrated with the positioning mod. It identifies edge cases that are NOT handled by the current implementation and documents them for future work.

## Implementation Tasks

### 1. Create Edge Case Integration Tests

**File:** `tests/integration/mods/positioning/straddling_edge_cases.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddling Waist System - Edge Cases', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('Mutual exclusivity with positioning states', () => {
    it('should prevent straddling when actor is sitting down', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          },
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 1
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent straddling when actor is kneeling', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          },
          'positioning:kneeling_before': {
            target_id: 'actor_2'
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent straddling when actor is bending over', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          },
          'positioning:bending_over': {
            target_id: 'actor_2'
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent straddling when actor is lying down', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          },
          'positioning:lying_down': {
            surface_id: 'furniture:bed_1'
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent sitting down when actor is straddling', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      testBed.createFurniture('furniture:chair_1', {
        components: {
          'furniture:seating': {
            seat_count: 2
          }
        }
      });

      const actions = testBed.discoverActions(actor);
      const sitActions = actions.filter(
        a => a.id === 'positioning:sit_down'
      );

      expect(sitActions).toHaveLength(0);
    });

    it('should prevent kneeling when actor is straddling', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'positioning:closeness': {
            partners: ['actor_2', 'actor_3']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      const otherActor = testBed.createActor('actor_3', {
        components: {
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:kneel_before');
    });

    it('should prevent bending over when actor is straddling', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:bend_over');
    });
  });

  describe('Cannot straddle scenarios', () => {
    it('should prevent straddling target who is not sitting', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const standingTarget = testBed.createActor('actor_2', {
        components: {
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent straddling without closeness', () => {
      const actor = testBed.createActor('actor_1', {
        components: {}
      });

      const sittingTarget = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });

    it('should prevent straddling multiple actors simultaneously', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'positioning:closeness': {
            partners: ['actor_2', 'actor_3']
          }
        }
      });

      const target1 = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          }
        }
      });

      const target2 = testBed.createActor('actor_3', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_2',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const actions = testBed.discoverActions(actor);

      // Should not be able to straddle second actor
      expect(actions).not.toContainAction('positioning:straddle_waist_facing');
      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });
  });

  describe('Future enhancement scenarios (NOT IMPLEMENTED)', () => {
    it.skip('should auto-dismount when target stands up', () => {
      // NOT IMPLEMENTED - Requires modification to get_up_from_furniture
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          }
        }
      });

      // Target stands up
      testBed.executeAction(
        'positioning:get_up_from_furniture',
        target,
        {}
      );

      // Actor should be auto-dismounted
      const straddlingComponent = testBed.getComponent(
        actor,
        'positioning:straddling_waist'
      );

      expect(straddlingComponent).toBeUndefined();
    });

    it.skip('should auto-dismount when closeness is broken', () => {
      // NOT IMPLEMENTED - Requires additional reactive rules
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      // Break closeness
      testBed.executeAction(
        'positioning:step_back',
        actor,
        { target: target.id }
      );

      // Actor should be auto-dismounted
      const straddlingComponent = testBed.getComponent(
        actor,
        'positioning:straddling_waist'
      );

      expect(straddlingComponent).toBeUndefined();
    });

    it.skip('should prevent target from leaving location while being straddled', () => {
      // NOT IMPLEMENTED - Requires event handler
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'core:position': {
            locationId: 'location:room_1'
          }
        }
      });

      // Attempt to change location
      const result = testBed.attemptLocationChange(
        target,
        'location:room_2'
      );

      // Should be prevented
      expect(result.success).toBe(false);
    });
  });
});
```

### 2. Create Performance Tests

**File:** `tests/performance/mods/positioning/straddling_performance.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddling Waist System - Performance Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('Action discovery performance', () => {
    it('should complete discovery in <10ms with 100 actors', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      // Create 100 actors, some sitting
      for (let i = 2; i <= 101; i++) {
        testBed.createActor(`actor_${i}`, {
          components: {
            ...(i % 10 === 0 && {
              'positioning:sitting_on': {
                furniture_id: `furniture:chair_${i}`,
                seat_index: 0
              }
            })
          }
        });
      }

      const startTime = performance.now();
      const actions = testBed.discoverActions(actor);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });

    it('should scale linearly with closeness circle size', () => {
      const circleSizes = [5, 10, 20, 50];
      const durations = [];

      circleSizes.forEach(size => {
        testBed.cleanup();
        testBed = createTestBed();

        const partnerIds = [];
        for (let i = 1; i <= size; i++) {
          partnerIds.push(`actor_${i}`);
        }

        const actor = testBed.createActor('actor_0', {
          components: {
            'positioning:closeness': {
              partners: partnerIds
            }
          }
        });

        // Create partners, half sitting
        partnerIds.forEach((id, index) => {
          testBed.createActor(id, {
            components: {
              ...(index % 2 === 0 && {
                'positioning:sitting_on': {
                  furniture_id: `furniture:chair_${index}`,
                  seat_index: 0
                }
              }),
              'positioning:closeness': {
                partners: ['actor_0']
              }
            }
          });
        });

        const startTime = performance.now();
        testBed.discoverActions(actor);
        const endTime = performance.now();

        durations.push(endTime - startTime);
      });

      // Check linear scaling (allow 2x tolerance)
      const ratio1 = durations[1] / durations[0]; // 10/5
      const ratio2 = durations[2] / durations[1]; // 20/10
      const ratio3 = durations[3] / durations[2]; // 50/20

      expect(ratio1).toBeLessThan(4); // Should be ~2, allow 2x margin
      expect(ratio2).toBeLessThan(4);
      expect(ratio3).toBeLessThan(6); // Larger size, slightly more tolerance
    });
  });

  describe('Action execution performance', () => {
    it('should complete straddling action execution in <50ms', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const startTime = performance.now();
      testBed.executeAction(
        'positioning:straddle_waist_facing',
        actor,
        { target: target.id }
      );
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should complete dismounting action execution in <50ms', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      const startTime = performance.now();
      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle facing away variant with same performance', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      const startTime = performance.now();
      testBed.executeAction(
        'positioning:straddle_waist_facing_away',
        actor,
        { target: target.id }
      );
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Scope query performance', () => {
    it('should evaluate actors_sitting_close scope efficiently', () => {
      const partnerIds = [];
      for (let i = 1; i <= 50; i++) {
        partnerIds.push(`actor_${i}`);
      }

      const actor = testBed.createActor('actor_0', {
        components: {
          'positioning:closeness': {
            partners: partnerIds
          }
        }
      });

      // Create partners, half sitting
      partnerIds.forEach((id, index) => {
        testBed.createActor(id, {
          components: {
            ...(index % 2 === 0 && {
              'positioning:sitting_on': {
                furniture_id: `furniture:chair_${index}`,
                seat_index: 0
              }
            })
          }
        });
      });

      const startTime = performance.now();
      const result = testBed.evaluateScope(
        'positioning:actors_sitting_close',
        { actor: actor }
      );
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
      expect(result).toHaveLength(25); // Half are sitting
    });

    it('should evaluate actor_im_straddling scope efficiently', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_50',
            facing_away: false
          }
        }
      });

      // Create 100 actors to search through
      for (let i = 2; i <= 101; i++) {
        testBed.createActor(`actor_${i}`, {
          components: {}
        });
      }

      const startTime = performance.now();
      const result = testBed.evaluateScope(
        'positioning:actor_im_straddling',
        { actor: actor }
      );
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('actor_50');
    });
  });
});
```

### 3. Document Future Enhancements

**File:** `docs/straddling-waist-future-enhancements.md`

**Content:**
```markdown
# Straddling Waist System - Future Enhancements

## Overview

This document outlines potential enhancements to the straddling waist system that are NOT currently implemented. These are edge cases and features that would improve the system but are not critical for initial release.

## Auto-Dismount Scenarios

### 1. Target Stands Up

**Scenario:** Actor A is straddling Actor B. Actor B stands up.

**Current Behavior:** Not handled - would result in invalid state

**Desired Behavior:** Actor A should be automatically dismounted

**Implementation Requirements:**
- Modify `positioning:get_up_from_furniture` rule
- Add check for actors with `straddling_waist` component targeting the standing actor
- Dispatch dismount events for all straddling actors
- Handle cascading cleanup (facing_away component, movement lock)

**Complexity:** Medium

**Priority:** Medium

### 2. Closeness Broken

**Scenario:** Actor A is straddling Actor B. Closeness between them is broken (e.g., `step_back`).

**Current Behavior:** Not handled - would result in invalid state

**Desired Behavior:** Actor A should be automatically dismounted

**Implementation Requirements:**
- Create reactive rule listening to closeness component removal
- Check if removed partner has `straddling_waist` component
- Dispatch automatic dismount event
- Handle cleanup for both actors

**Complexity:** Medium

**Priority:** Medium

### 3. Location Change

**Scenario:** Actor A is straddling Actor B. Actor B attempts to change location.

**Current Behavior:** Movement lock should prevent this, but no specific validation

**Desired Behavior:**
- Option 1: Prevent location change entirely
- Option 2: Auto-dismount and allow location change

**Implementation Requirements:**
- Add event handler for location change events
- Check if actor has `straddling_waist` component
- Either block or auto-dismount based on design decision

**Complexity:** Low

**Priority:** Low

## Alternative Actions

### 1. Turn Around While Straddling

**Scenario:** Actor A is straddling Actor B while facing them. Actor A wants to face away without dismounting.

**Current Behavior:** Not available - must dismount and re-straddle

**Desired Behavior:** Single action to flip orientation

**Implementation Requirements:**
- New action: `positioning:turn_around_while_straddling`
- Modify `straddling_waist` component: `facing_away` boolean
- Add/remove `facing_away` component as needed
- No movement lock changes
- Dispatch orientation change event

**Complexity:** Low

**Priority:** Low

### 2. Shift Position on Lap

**Scenario:** Actor A is straddling Actor B. Actor A wants to adjust position slightly.

**Current Behavior:** Not available

**Desired Behavior:** Cosmetic action for narrative variety

**Implementation Requirements:**
- New action: `positioning:shift_position_on_lap`
- No component changes
- Only generates log message and perceptible event
- Pure narrative/flavor action

**Complexity:** Very Low

**Priority:** Very Low

### 3. Multiple Actor Straddling

**Scenario:** Two or more actors straddle the same target simultaneously.

**Current Behavior:** Not supported (single straddler per target)

**Desired Behavior:** Allow multiple actors to straddle same sitting target

**Implementation Requirements:**
- Modify component schema to track multiple straddlers
- Update scope queries
- Handle cleanup when any straddler dismounts
- Consider physical constraints and validation

**Complexity:** High

**Priority:** Low

## Integration with Other Systems

### 1. Anatomy System Integration

**Purpose:** Check leg availability for straddling

**Requirements:**
- Add prerequisite checking leg functionality
- Validate actor can physically straddle
- Handle edge cases (injured legs, prosthetics, etc.)

**Complexity:** Medium

**Priority:** Low

### 2. Clothing System Integration

**Purpose:** Restrict straddling based on clothing

**Requirements:**
- Check clothing restrictions (e.g., tight skirts)
- Add prerequisite for compatible clothing
- Handle edge cases and special clothing types

**Complexity:** Medium

**Priority:** Low

### 3. Weight/Size System Integration

**Purpose:** Validate physical compatibility

**Requirements:**
- Check relative sizes of actor and target
- Add prerequisite for size compatibility
- Handle edge cases and special scenarios

**Complexity:** High

**Priority:** Low

## Performance Optimizations

### 1. Scope Query Caching

**Purpose:** Cache scope query results for frequently-accessed data

**Benefits:** Reduced computation for repeated queries

**Complexity:** Medium

**Priority:** Low

### 2. Component Index

**Purpose:** Index actors by component type for faster lookups

**Benefits:** Faster `actor_im_straddling` scope evaluation

**Complexity:** High

**Priority:** Very Low

## Testing Gaps

### 1. Concurrent Action Handling

**Scenario:** Two actors attempt to straddle same target simultaneously

**Current Coverage:** Not tested

**Desired Coverage:** Validate race condition handling

**Priority:** Medium

### 2. Component Desync Scenarios

**Scenario:** Manual component manipulation creates invalid state

**Current Coverage:** Not tested

**Desired Coverage:** Validate error handling and recovery

**Priority:** Low

### 3. Cross-Mod Interaction

**Scenario:** Other mods interact with straddling system

**Current Coverage:** Not tested

**Desired Coverage:** Validate compatibility with other positioning mods

**Priority:** Medium

## Conclusion

These enhancements are documented for future consideration. The current implementation provides a solid foundation, but these features would improve robustness and user experience.

**Recommendation:** Prioritize auto-dismount scenarios for next iteration, as they address the most critical edge cases.
```

## Design Decisions

### Skipped Test Pattern

**Decision:** Use `.skip()` for unimplemented future scenarios
**Rationale:**
- Documents expected behavior
- Prevents false failures
- Easy to enable when implemented
- Serves as specification

### Performance Thresholds

**Decision:** 10ms discovery, 50ms execution
**Rationale:**
- Based on existing positioning action benchmarks
- Allows for reasonable overhead
- Accounts for system variability
- Matches user expectations

### Linear Scaling Validation

**Decision:** Test scope query performance with varying sizes
**Rationale:**
- Ensures algorithmic efficiency
- Prevents performance regression
- Validates O(n) complexity assumption
- Catches optimization opportunities

## Testing Strategy

### Edge Case Coverage
- Mutual exclusivity validation
- Cannot straddle scenarios
- Future enhancement documentation (skipped tests)

### Performance Coverage
- Action discovery (<10ms)
- Action execution (<50ms)
- Scope query efficiency
- Linear scaling validation

### Manual Testing
```bash
# Run edge case tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddling_edge_cases.test.js --verbose

# Run performance tests
NODE_ENV=test npm run test:performance -- tests/performance/mods/positioning/straddling_performance.test.js --verbose
```

## Acceptance Criteria

- [ ] Edge case test file created
- [ ] All mutual exclusivity scenarios tested
- [ ] Cannot straddle scenarios tested
- [ ] Future enhancement scenarios documented (skipped)
- [ ] Performance test file created
- [ ] Discovery performance validated (<10ms)
- [ ] Execution performance validated (<50ms)
- [ ] Scope query performance validated
- [ ] Linear scaling validated
- [ ] Future enhancements documented
- [ ] All tests pass
- [ ] No performance regressions

## Verification Commands

```bash
# Run edge case tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddling_edge_cases.test.js --verbose

# Run performance tests
NODE_ENV=test npm run test:performance -- tests/performance/mods/positioning/straddling_performance.test.js --verbose

# Run all straddling system tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle* tests/integration/mods/positioning/dismount* --silent
NODE_ENV=test npm run test:performance -- tests/performance/mods/positioning/straddling* --silent

# Full test suite
npm run test:ci
```

## References

### Similar Test Patterns
- `tests/integration/mods/positioning/kneeling_edge_cases.test.js`
- `tests/performance/mods/positioning/sitting_performance.test.js`
- `tests/integration/mods/positioning/bending_over_edge_cases.test.js`

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Section: Testing Strategy)
- Spec: `specs/straddling-waist-system.spec.md` (Section: Future Enhancements)

## Notes

- This ticket completes the straddling waist system implementation
- Future enhancements are documented but not implemented
- Performance tests establish baseline metrics
- Edge case tests validate system robustness
- Skipped tests serve as specification for future work
