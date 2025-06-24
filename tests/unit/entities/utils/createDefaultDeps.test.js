import { describe, it, expect, jest } from '@jest/globals';
import { createDefaultDeps } from '../../../../src/entities/utils/createDefaultDeps.js';
import InMemoryEntityRepository from '../../../../src/adapters/InMemoryEntityRepository.js';
import UuidGenerator from '../../../../src/adapters/UuidGenerator.js';
import LodashCloner from '../../../../src/adapters/LodashCloner.js';
import DefaultComponentPolicy from '../../../../src/adapters/DefaultComponentPolicy.js';

class FakeRepo {}

describe('createDefaultDeps', () => {
  it('returns default implementations when no overrides are provided', () => {
    const deps = createDefaultDeps();
    expect(deps.repository).toBeInstanceOf(InMemoryEntityRepository);
    expect(deps.idGenerator).toBe(UuidGenerator);
    expect(deps.cloner).toBe(LodashCloner);
    expect(deps.defaultPolicy).toBeInstanceOf(DefaultComponentPolicy);
  });

  it('uses factory overrides when supplied', () => {
    const repo = new FakeRepo();
    const repoFactory = jest.fn(() => repo);
    const deps = createDefaultDeps({ repositoryFactory: repoFactory });
    expect(deps.repository).toBe(repo);
    expect(repoFactory).toHaveBeenCalled();
  });
});
