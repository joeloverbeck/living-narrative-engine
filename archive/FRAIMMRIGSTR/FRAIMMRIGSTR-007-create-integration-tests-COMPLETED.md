# FRAIMMRIGSTR-007: Create Integration Tests for Fracture Immunity System

## Summary
Create integration tests that verify the fracture immunity system works correctly with real entity definition data and the full damage application pipeline (ApplyDamageHandler -> DamageResolutionService -> DamageTypeEffectsService).

## Status
Completed

## Background
Unit tests verify the FractureApplicator in isolation. Integration tests verify that the complete system:
1. Correctly loads entities with/without the `anatomy:has_rigid_structure` component
2. Applies fractures only to parts with rigid structure
3. Rejects fractures on soft tissue parts

## File List

### Files to Create
- `tests/integration/anatomy/fractureImmunity.integration.test.js`

### Reference Files (read-only)
- `src/anatomy/applicators/fractureApplicator.js` (implementation)
- `tests/unit/anatomy/applicators/fractureApplicator.test.js` (unit test patterns)
- `data/mods/anatomy/entities/definitions/human_leg.entity.json` (entity with component)
- `data/mods/anatomy/entities/definitions/human_penis.entity.json` (entity without component)

## Out of Scope
- **DO NOT** modify source code in `src/`
- **DO NOT** modify entity definition files
- **DO NOT** modify unit tests
- **DO NOT** create E2E tests (FRAIMMRIGSTR-008)

## Implementation Details

### Test Structure
```javascript
/**
 * @file Integration tests for fracture immunity system
 * @see src/anatomy/applicators/fractureApplicator.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import test fixtures and helpers

describe('Fracture Immunity System - Integration', () => {
  let fixture;

  beforeEach(async () => {
    // Setup real entity manager with mod data
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('Soft Tissue Parts', () => {
    it('should NOT fracture penis entity regardless of damage', async () => {
      // Load human_penis entity
      // Apply massive damage (above any threshold)
      // Verify NO fractured component was added
    });

    it('should NOT fracture breast entity regardless of damage', async () => {
      // Similar test for breast
    });

    it('should NOT fracture ass_cheek entity regardless of damage', async () => {
      // Similar test for ass_cheek
    });

    it('should NOT fracture tentacle entity regardless of damage', async () => {
      // Similar test for tentacle (creature)
    });
  });

  describe('Skeletal Parts with Bone', () => {
    it('should fracture leg entity when damage exceeds threshold', async () => {
      // Load human_leg entity (has anatomy:has_rigid_structure)
      // Apply damage above 50% threshold
      // Verify fractured component WAS added
    });

    it('should fracture arm entity when damage exceeds threshold', async () => {
      // Similar test for arm
    });

    it('should NOT fracture leg entity when damage below threshold', async () => {
      // Load human_leg entity
      // Apply damage below threshold (e.g., 40% of max health)
      // Verify NO fractured component (threshold not met, not immunity)
    });
  });

  describe('Exoskeletal Parts', () => {
    it('should fracture spider leg (chitin) when damage exceeds threshold', async () => {
      // Load spider_leg entity
      // Apply damage above threshold
      // Verify fractured component WAS added
    });

    it('should fracture tortoise carapace (shell) when damage exceeds threshold', async () => {
      // Load tortoise_carapace entity
      // Apply damage above threshold
      // Verify fractured component WAS added
    });

    it('should NOT fracture spider spinneret (soft tissue)', async () => {
      // Load spider_spinneret entity
      // Apply massive damage
      // Verify NO fractured component
    });
  });

  // No additional edge-case coverage in this ticket:
  // - No existing entity definition uses {"anatomy:has_rigid_structure": {}}
  // - Missing entity behavior is handled by ApplyDamageHandler error dispatching,
  //   not a fracture-specific return value
});
```

### Test Data Requirements
The tests require the following entities to exist with proper component configuration (all currently present in `data/mods/`):

**With `anatomy:has_rigid_structure`:**
- `anatomy:human_leg` (bone)
- `anatomy:humanoid_arm` (bone)
- `anatomy-creatures:spider_leg` (chitin)
- `anatomy-creatures:tortoise_carapace` (shell)

**Without `anatomy:has_rigid_structure`:**
- `anatomy:human_penis` (soft tissue)
- `anatomy:human_breast` (soft tissue)
- `anatomy:human_ass_cheek` (soft tissue)
- `anatomy-creatures:spider_spinneret` (soft tissue)
- `anatomy-creatures:squid_tentacle` (soft tissue)

### Test Helpers Needed
May need to create or use existing helpers for:
- Loading real entities from mod data
- Applying damage through the damage pipeline
- Checking for component presence on entities
  - Use InMemoryDataRegistry + TestEntityManagerAdapter with entity definitions loaded from disk
  - Load `data/mods/anatomy/status-effects/status-effects.registry.json` for effect defaults

## Acceptance Criteria

### Tests That Must Pass
```bash
NODE_ENV=test npx jest tests/integration/anatomy/fractureImmunity.integration.test.js --no-coverage --verbose
npm run test:integration
```
- All new integration tests pass
- No regressions in existing integration tests

### Invariants That Must Remain True
- Tests use real entity data from mods (not mocked entity definitions)
- Tests verify actual component presence/absence
- Tests follow existing integration test patterns in the project
- Each test case is independent and isolated

## Estimated Diff Size
~150-200 lines (new file)

## Dependencies
- FRAIMMRIGSTR-001 (component schema must exist)
- FRAIMMRIGSTR-002 (applicator code must be updated)
- FRAIMMRIGSTR-003 (unit tests should pass first)
- FRAIMMRIGSTR-004 through FRAIMMRIGSTR-006B (entity data must be updated)

## Blocked By
- FRAIMMRIGSTR-002, FRAIMMRIGSTR-003
- At least some entity updates (004-006B) for test data

## Blocks
- FRAIMMRIGSTR-008 (E2E tests build on integration test patterns)

## Outcome
- Updated assumptions to match available entity data and pipeline behavior.
- Added integration coverage for rigid vs soft tissue fractures using real mod entity definitions.
- No source or entity definition changes required.
