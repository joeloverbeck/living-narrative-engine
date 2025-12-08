import { describe, expect, it, jest } from '@jest/globals';
import { executeSeededDamageApplication } from '../../../../src/anatomy/workflows/stages/seededDamageApplicationStage.js';

describe('SeededDamageApplicationStage', () => {
  const logger = { debug: jest.fn(), warn: jest.fn() };

  it('skips when no applier is provided', async () => {
    const dataRegistry = { get: jest.fn() };

    await executeSeededDamageApplication(
      {
        recipeId: 'anatomy:test_recipe',
        ownerId: 'entity-1',
        slotToPartMappings: new Map(),
      },
      { dataRegistry, logger }
    );

    expect(dataRegistry.get).not.toHaveBeenCalled();
  });

  it('delegates to the seededDamageApplier when initialDamage is present', async () => {
    const initialDamage = { head: { amount: 3, name: 'blunt' } };
    const dataRegistry = {
      get: jest.fn().mockReturnValue({ initialDamage }),
    };
    const seededDamageApplier = {
      applySeededDamage: jest.fn().mockResolvedValue(undefined),
    };

    await executeSeededDamageApplication(
      {
        recipeId: 'anatomy:test_recipe',
        ownerId: 'entity-1',
        slotToPartMappings: new Map([['head', 'part-1']]),
      },
      { dataRegistry, logger, seededDamageApplier }
    );

    expect(seededDamageApplier.applySeededDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'entity-1',
        recipeId: 'anatomy:test_recipe',
        initialDamage,
      })
    );
  });
});
