/**
 * @file Integration test for AnatomyGraphContext duplicate slot key detection
 *
 * Tests fail-fast behavior when duplicate slot keys are detected during
 * anatomy graph construction.
 */

import { describe, it, expect } from '@jest/globals';
import AnatomyGraphContext from '../../../src/anatomy/anatomyGraphContext.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('AnatomyGraphContext duplicate slot key detection (integration)', () => {
  describe('fail-fast behavior during graph creation', () => {
    it('should fail immediately when duplicate slot key is mapped', () => {
      const context = new AnatomyGraphContext();

      // Set up a root entity
      context.setRootId('root-body');

      // Simulate normal slot processing - first slot is fine
      context.mapSlotToEntity('left_leg', 'entity-left-leg-001');
      context.addCreatedEntity('entity-left-leg-001');
      context.occupySocket('root-body', 'left_leg_socket');

      // Simulate processing right leg - also fine
      context.mapSlotToEntity('right_leg', 'entity-right-leg-001');
      context.addCreatedEntity('entity-right-leg-001');
      context.occupySocket('root-body', 'right_leg_socket');

      // Simulate erroneous duplicate mapping (the chicken bug scenario)
      // This represents a blueprint where the same slot key accidentally appears twice
      expect(() => {
        context.mapSlotToEntity('left_leg', 'entity-left-leg-002');
      }).toThrow(ValidationError);
    });

    it('should prevent partial graph corruption by failing before second mapping', () => {
      const context = new AnatomyGraphContext();

      context.setRootId('root-body');
      context.mapSlotToEntity('torso', 'entity-torso');
      context.addCreatedEntity('entity-torso');

      // First mapping succeeds
      context.mapSlotToEntity('left_arm', 'entity-arm-first');
      context.addCreatedEntity('entity-arm-first');

      // Duplicate mapping should fail fast
      expect(() => {
        context.mapSlotToEntity('left_arm', 'entity-arm-duplicate');
      }).toThrow(ValidationError);

      // Verify original mapping is still intact
      expect(context.getEntityForSlot('left_arm')).toBe('entity-arm-first');
      expect(context.getCreatedEntities()).toContain('entity-arm-first');
      // The duplicate entity was never added
      expect(context.getCreatedEntities()).not.toContain('entity-arm-duplicate');
    });

    it('should provide clear error message for debugging duplicate slot issues', () => {
      const context = new AnatomyGraphContext();
      context.setRootId('root');

      context.mapSlotToEntity('chicken_foot', 'left-foot-entity');

      let caughtError;
      try {
        context.mapSlotToEntity('chicken_foot', 'right-foot-entity');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ValidationError);
      expect(caughtError.message).toContain('chicken_foot');
      expect(caughtError.message).toContain('left-foot-entity');
      expect(caughtError.message).toContain('right-foot-entity');
      expect(caughtError.message).toContain('Duplicate slot keys detected');
    });
  });
});
