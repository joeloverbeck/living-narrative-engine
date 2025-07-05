import { describe, it, expect, jest } from '@jest/globals';
import { updateMovementLock } from '../../../src/utils/movementUtils.js';

/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

describe('updateMovementLock', () => {
  describe('legacy entities without anatomy', () => {
    it('returns cloned component with updated lock state without mutating original', () => {
      const original = { locked: false, speed: 10 };
      /** @type {jest.Mocked<IEntityManager>} */
      const manager = {
        getComponentData: jest.fn((id, componentId) => {
          if (componentId === 'anatomy:body') return undefined;
          if (componentId === 'core:movement') return original;
          return undefined;
        }),
        addComponent: jest.fn(),
      };

      const result = updateMovementLock(manager, 'e1', true);

      expect(result).toEqual({ locked: true, speed: 10 });
      expect(result).not.toBe(original);
      expect(original.locked).toBe(false);
      expect(manager.addComponent).toHaveBeenCalledWith(
        'e1',
        'core:movement',
        result
      );
    });

    it('returns null when no movement component exists', () => {
      /** @type {jest.Mocked<IEntityManager>} */
      const manager = {
        getComponentData: jest.fn().mockReturnValue(undefined),
        addComponent: jest.fn(),
      };

      const result = updateMovementLock(manager, 'e2', false);

      expect(result).toBeNull();
      expect(manager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('anatomy-based entities', () => {
    it('updates movement on all body parts with movement component', () => {
      const leftLegMovement = { locked: false, forcedOverride: false };
      const rightLegMovement = { locked: false, forcedOverride: false };
      
      /** @type {jest.Mocked<IEntityManager>} */
      const manager = {
        getComponentData: jest.fn((id, componentId) => {
          if (id === 'hero1' && componentId === 'anatomy:body') {
            return { 
              body: {
                root: 'body1',
                parts: {
                  torso: 'body1',
                  leg_left: 'left-leg1',
                  leg_right: 'right-leg1'
                }
              }
            };
          }
          if (id === 'left-leg1' && componentId === 'core:movement') {
            return leftLegMovement;
          }
          if (id === 'right-leg1' && componentId === 'core:movement') {
            return rightLegMovement;
          }
          return undefined;
        }),
        addComponent: jest.fn(),
      };

      const result = updateMovementLock(manager, 'hero1', true);

      expect(result).toEqual({
        updatedParts: [
          { partId: 'left-leg1', movement: { locked: true, forcedOverride: false } },
          { partId: 'right-leg1', movement: { locked: true, forcedOverride: false } },
        ],
        locked: true,
      });
      
      expect(manager.addComponent).toHaveBeenCalledTimes(2);
      expect(manager.addComponent).toHaveBeenCalledWith(
        'left-leg1',
        'core:movement',
        { locked: true, forcedOverride: false }
      );
      expect(manager.addComponent).toHaveBeenCalledWith(
        'right-leg1',
        'core:movement',
        { locked: true, forcedOverride: false }
      );
    });

    it('returns null when no body parts have movement component', () => {
      /** @type {jest.Mocked<IEntityManager>} */
      const manager = {
        getComponentData: jest.fn((id, componentId) => {
          if (id === 'hero2' && componentId === 'anatomy:body') {
            return { 
              body: {
                root: 'body2',
                parts: {
                  torso: 'body2',
                  arm_left: 'arm1',
                  arm_right: 'arm2'
                }
              }
            };
          }
          return undefined;
        }),
        addComponent: jest.fn(),
      };

      const result = updateMovementLock(manager, 'hero2', true);

      expect(result).toBeNull();
      expect(manager.addComponent).not.toHaveBeenCalled();
    });

    it('handles all body parts with movement components', () => {
      const legMovement = { locked: false, forcedOverride: false };
      const footMovement = { locked: false, forcedOverride: false };
      
      /** @type {jest.Mocked<IEntityManager>} */
      const manager = {
        getComponentData: jest.fn((id, componentId) => {
          if (id === 'hero3' && componentId === 'anatomy:body') {
            return { 
              body: {
                root: 'body3',
                parts: {
                  torso: 'body3',
                  leg_left: 'leg1',
                  foot_left: 'foot1'
                }
              }
            };
          }
          if (id === 'leg1' && componentId === 'core:movement') {
            return legMovement;
          }
          if (id === 'foot1' && componentId === 'core:movement') {
            return footMovement;
          }
          return undefined;
        }),
        addComponent: jest.fn(),
      };

      const result = updateMovementLock(manager, 'hero3', false);

      expect(result).toEqual({
        updatedParts: [
          { partId: 'leg1', movement: { locked: false, forcedOverride: false } },
          { partId: 'foot1', movement: { locked: false, forcedOverride: false } },
        ],
        locked: false,
      });
      
      expect(manager.addComponent).toHaveBeenCalledWith(
        'leg1',
        'core:movement',
        { locked: false, forcedOverride: false }
      );
      expect(manager.addComponent).toHaveBeenCalledWith(
        'foot1',
        'core:movement',
        { locked: false, forcedOverride: false }
      );
    });
  });
});
