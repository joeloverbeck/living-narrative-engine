import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';

describe('GraphIntegrityValidator', () => {
  let em;
  let logger;
  let validator;

  beforeEach(() => {
    em = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
      getComponentsForEntity: jest.fn(() => ({})),
    };
    logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    validator = new GraphIntegrityValidator({ entityManager: em, logger });
  });

  it('detects socket count violations', async () => {
    em.getComponentData.mockImplementation((id, comp) => {
      if (comp === 'anatomy:sockets') {
        return { sockets: [{ id: 's1', maxCount: 1 }] };
      }
      return null;
    });
    const result = await validator.validateGraph(
      ['e1'],
      {},
      new Map([['e1:s1', 2]])
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceeds maxCount');
  });

  it('warns for orphaned parts', async () => {
    em.getComponentData.mockImplementation((id, comp) => {
      if (comp === 'anatomy:joint') {
        return { parentId: 'missing', socketId: 's1', jointType: 'ball' };
      }
      if (comp === 'anatomy:sockets') {
        return { sockets: [] };
      }
      return null;
    });
    const result = await validator.validateGraph(['child'], {}, new Map());
    expect(result.warnings[0]).toContain('orphaned');
  });
});
