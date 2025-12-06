/**
 * @file Additional coverage for BodyDescriptionComposer guard clauses.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

/**
 *
 * @param overrides
 */
function createComposer(overrides = {}) {
  const logger = overrides.logger || {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const composer = new BodyDescriptionComposer({
    bodyPartDescriptionBuilder: {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    },
    bodyGraphService: {
      getAllParts: jest.fn(),
    },
    entityFinder: {
      getEntityInstance: jest.fn(),
    },
    anatomyFormattingService: {
      getDescriptionOrder: jest.fn(() => []),
      getGroupedParts: jest.fn(() => new Set()),
      getPairedParts: jest.fn(() => new Set()),
      formatDescriptorValue: jest.fn((label, value) => `${label}: ${value}`),
      formatPartName: jest.fn((value) => value),
    },
    partDescriptionGenerator: {
      generatePartDescription: jest.fn(),
    },
    logger,
    ...overrides.dependencies,
  });

  return { composer, logger };
}

describe('BodyDescriptionComposer guard coverage', () => {
  let composer;
  let logger;

  beforeEach(() => {
    ({ composer, logger } = createComposer());
  });

  it('returns empty string and logs an error when hasComponent is missing', async () => {
    const malformedEntity = {
      id: 'actor-17',
      getComponentData: jest.fn(),
    };

    const result = await composer.composeDescription(malformedEntity);

    expect(result).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      'BodyDescriptionComposer.composeDescription: bodyEntity does not have hasComponent method',
      expect.objectContaining({
        bodyEntityType: 'object',
        bodyEntityKeys: expect.arrayContaining(['id', 'getComponentData']),
        bodyEntityId: 'actor-17',
      })
    );
  });

  it('returns empty string and logs an error when getComponentData is missing', async () => {
    const malformedEntity = {
      id: 'actor-23',
      hasComponent: jest.fn(),
    };

    const result = await composer.composeDescription(malformedEntity);

    expect(result).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      'BodyDescriptionComposer.composeDescription: bodyEntity does not have getComponentData method',
      expect.objectContaining({
        bodyEntityType: 'object',
        bodyEntityKeys: expect.arrayContaining(['id', 'hasComponent']),
        bodyEntityId: 'actor-23',
      })
    );
  });
});
