import { describe, it, expect, jest } from '@jest/globals';
import { createDefaultDeps } from '../../../../src/entities/utils/createDefaultDeps.js';
import UuidGenerator from '../../../../src/adapters/UuidGenerator.js';
import LodashCloner from '../../../../src/adapters/LodashCloner.js';
import DefaultComponentPolicy from '../../../../src/adapters/DefaultComponentPolicy.js';

describe('createDefaultDeps', () => {
  it('returns default implementations when no overrides are provided', () => {
    const deps = createDefaultDeps();
    expect(deps.idGenerator).toBe(UuidGenerator);
    expect(deps.cloner).toBe(LodashCloner);
    expect(deps.defaultPolicy).toBeInstanceOf(DefaultComponentPolicy);
  });

  it('uses factory overrides when supplied', () => {
    const customId = () => 'custom';
    const idFactory = jest.fn(() => customId);
    const deps = createDefaultDeps({ idGeneratorFactory: idFactory });
    expect(deps.idGenerator).toBe(customId);
    expect(idFactory).toHaveBeenCalled();
  });
});
