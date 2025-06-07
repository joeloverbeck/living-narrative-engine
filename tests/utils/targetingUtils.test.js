import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prepareNameMatchCandidates } from '../../src/utils/targetingUtils.js';
import { createMockLogger } from '../testUtils.js';

/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

describe('prepareNameMatchCandidates', () => {
  /** @type {IEntityManager} */
  let entityManager;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = {
      getEntityInstance: jest.fn(),
    };
  });

  it('returns empty array when no ids provided', async () => {
    const result = await prepareNameMatchCandidates(
      [],
      entityManager,
      jest.fn(),
      logger,
      { domainContextForLogging: 'test' }
    );
    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'prepareNameMatchCandidates: No entity IDs provided by source for test.'
    );
  });

  it('excludes specified entity id', async () => {
    entityManager.getEntityInstance.mockReturnValue({ id: 'e1' });
    const getName = jest.fn(() => 'Name');
    const result = await prepareNameMatchCandidates(
      ['e1'],
      entityManager,
      getName,
      logger,
      {
        domainContextForLogging: 'actors',
        entityIdToExclude: 'e1',
      }
    );
    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      "prepareNameMatchCandidates: Excluding entity ID 'e1' (actor) from domain 'actors'."
    );
  });

  it('builds candidates and skips invalid entries', async () => {
    const entities = {
      e1: { id: 'e1' },
      e2: { id: 'e2' },
    };
    entityManager.getEntityInstance.mockImplementation(
      (id) => entities[id] || null
    );
    const getName = jest.fn((ent) => (ent.id === 'e1' ? 'Alpha' : ''));
    const ids = ['e1', 'e2', 'missing', '', 123];

    const result = await prepareNameMatchCandidates(
      ids,
      entityManager,
      getName,
      logger,
      {
        domainContextForLogging: 'test-dom',
      }
    );

    expect(result).toEqual([{ id: 'e1', name: 'Alpha' }]);
    expect(logger.warn).toHaveBeenCalledTimes(4);
    const warnMessages = logger.warn.mock.calls.map((c) => c[0]).join(' ');
    expect(warnMessages).toContain(
      'Invalid (non-string or empty) entity ID encountered'
    );
    expect(warnMessages).toContain("Entity 'missing' from test-dom not found");
    expect(warnMessages).toContain('returned no valid name');
  });

  it('accepts a function returning ids', async () => {
    entityManager.getEntityInstance.mockReturnValue({ id: 'e1' });
    const result = await prepareNameMatchCandidates(
      () => ['e1'],
      entityManager,
      () => 'Alpha',
      logger,
      {
        domainContextForLogging: 'fn-source',
      }
    );
    expect(result).toEqual([{ id: 'e1', name: 'Alpha' }]);
  });
});
