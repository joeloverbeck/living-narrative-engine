/**
 * @file Coverage test for error handler factory fallback logic in ClichesGeneratorController.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClichesGeneratorController } from '../../../../src/clichesGenerator/controllers/ClichesGeneratorController.js';

describe('ClichesGeneratorController error handler factory fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to the default error handler when provided factory is not a function', () => {
    const dependencies = {
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      characterBuilderService: {
        initialize: jest.fn(),
        getAllCharacterConcepts: jest.fn(),
        createCharacterConcept: jest.fn(),
        updateCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        getCharacterConcept: jest.fn(),
        generateThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
      },
      eventBus: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
      schemaValidator: {
        validate: jest.fn().mockReturnValue({ valid: true }),
      },
      clicheGenerator: {
        generateCliches: jest.fn(),
        parseLLMResponse: jest.fn(),
      },
      // Provide a truthy value that is not a function so the fallback path executes.
      errorHandlerFactory: { notAFunction: true },
    };

    // Act: instantiate the controller so the constructor exercises the fallback.
    // eslint-disable-next-line no-new
    new ClichesGeneratorController(dependencies);

    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      'ClicheErrorHandler initialized successfully'
    );
    expect(dependencies.logger.error).not.toHaveBeenCalled();
  });
});
