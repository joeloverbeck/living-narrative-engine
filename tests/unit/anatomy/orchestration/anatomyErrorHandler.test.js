import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  AnatomyErrorHandler,
  AnatomyGenerationError,
  DescriptionGenerationError,
  GraphBuildingError,
} from '../../../../src/anatomy/orchestration/anatomyErrorHandler.js';
import { createMockLogger } from '../../../common/mockFactories.js';

describe('AnatomyErrorHandler', () => {
  let logger;
  let handler;

  beforeEach(() => {
    logger = createMockLogger();
    handler = new AnatomyErrorHandler({ logger });
  });

  it('returns the same error when already wrapped', () => {
    const error = new AnatomyGenerationError('msg', 'e1', 'r1');
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e1',
      recipeId: 'r1',
    });
    expect(result).toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyErrorHandler: AnatomyGenerationError occurred during anatomy operation',
      expect.objectContaining({
        error: 'msg',
        context: { operation: 'generation', entityId: 'e1', recipeId: 'r1' },
        entityId: 'e1',
        recipeId: 'r1',
      })
    );
  });

  it('wraps generic errors for generation operation', () => {
    const error = new Error('boom');
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e2',
      recipeId: 'r2',
    });
    expect(result).toBeInstanceOf(AnatomyGenerationError);
    expect(result.cause).toBe(error);
    expect(result.entityId).toBe('e2');
    expect(result.recipeId).toBe('r2');
  });

  it('wraps generic errors for description operation', () => {
    const error = new Error('oops');
    const result = handler.handle(error, {
      operation: 'description',
      entityId: 'e3',
      partIds: ['p1', 'p2'],
    });
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    expect(result.partIds).toEqual(['p1', 'p2']);
    expect(result.cause).toBe(error);
  });

  it('wraps generic errors for graphBuilding operation', () => {
    const error = new Error('bad');
    const result = handler.handle(error, {
      operation: 'graphBuilding',
      rootId: 'root-1',
    });
    expect(result).toBeInstanceOf(GraphBuildingError);
    expect(result.rootId).toBe('root-1');
    expect(result.cause).toBe(error);
  });

  it('defaults to AnatomyGenerationError when operation unknown', () => {
    const error = new Error('fail');
    const result = handler.handle(error, { entityId: 'e4' });
    expect(result).toBeInstanceOf(AnatomyGenerationError);
    expect(result.entityId).toBe('e4');
  });

  it('logs cause information when present', () => {
    const cause = new Error('inner');
    const error = new Error('outer', { cause });
    const result = handler.handle(error, {
      operation: 'generation',
      entityId: 'e5',
    });
    expect(result.cause).toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyErrorHandler: Error occurred during anatomy operation',
      expect.objectContaining({
        causedBy: { name: cause.name, message: cause.message },
        context: { operation: 'generation', entityId: 'e5' },
      })
    );
  });
});
