import { describe, it, expect, jest } from '@jest/globals';
import { updateMovementLock } from '../../../src/utils/movementUtils.js';

/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

describe('updateMovementLock', () => {
  it('returns cloned component with updated lock state without mutating original', () => {
    const original = { locked: false, speed: 10 };
    /** @type {jest.Mocked<IEntityManager>} */
    const manager = {
      getComponentData: jest.fn().mockReturnValue(original),
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

  it('creates new component when none exists', () => {
    /** @type {jest.Mocked<IEntityManager>} */
    const manager = {
      getComponentData: jest.fn().mockReturnValue(undefined),
      addComponent: jest.fn(),
    };

    const result = updateMovementLock(manager, 'e2', false);

    expect(result).toEqual({ locked: false });
    expect(manager.addComponent).toHaveBeenCalledWith(
      'e2',
      'core:movement',
      result
    );
  });
});
