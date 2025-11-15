/**
 * @file Additional coverage for BaseCharacterBuilderController event listener helpers
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import {
  BaseCharacterBuilderControllerTestBase,
  TestController,
} from './BaseCharacterBuilderController.testbase.js';
import { EventListenerRegistry } from '../../../../src/characterBuilder/services/eventListenerRegistry.js';
import { ErrorHandlingStrategy } from '../../../../src/characterBuilder/services/errorHandlingStrategy.js';

describe('BaseCharacterBuilderController event listener utilities', () => {
  let testBase;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    testBase.controller = new TestController(testBase.mockDependencies);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await testBase.cleanup();
  });

  it('provides access to the shared event listener registry instance', () => {
    const firstRegistry = testBase.controller.eventRegistry;
    const secondRegistry = testBase.controller.eventRegistry;

    expect(firstRegistry).toBeInstanceOf(EventListenerRegistry);
    expect(secondRegistry).toBe(firstRegistry);
  });

  it('returns null when adding a debounced listener with a missing element', () => {
    const registry = testBase.controller.eventRegistry;
    const spy = jest.spyOn(registry, 'addDebouncedListener');
    const result = testBase.controller._addDebouncedListener(
      'missingButton',
      'click',
      jest.fn(),
      150
    );

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null when adding a throttled listener without a resolved target', () => {
    const registry = testBase.controller.eventRegistry;
    const spy = jest.spyOn(registry, 'addThrottledListener');
    const result = testBase.controller._addThrottledListener(
      'missingScroller',
      'scroll',
      jest.fn(),
      200
    );

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null when adding an async click handler without a matching element', () => {
    const registry = testBase.controller.eventRegistry;
    const spy = jest.spyOn(registry, 'addAsyncClickHandler');
    const result = testBase.controller._addAsyncClickHandler(
      'missingAction',
      jest.fn()
    );

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('delegates to ErrorHandlingStrategy when building error details', () => {
    const sentinelDetails = { sentinel: true };
    const buildSpy = jest
      .spyOn(ErrorHandlingStrategy.prototype, 'buildErrorDetails')
      .mockReturnValue(sentinelDetails);
    const error = new Error('sentinel error');
    const context = { operation: 'unit-test' };

    const result = testBase.controller._buildErrorDetails(error, context);

    expect(buildSpy).toHaveBeenCalledWith(error, context);
    expect(result).toBe(sentinelDetails);
  });

  it('delegates to ErrorHandlingStrategy when categorizing errors', () => {
    const categorizeSpy = jest
      .spyOn(ErrorHandlingStrategy.prototype, 'categorizeError')
      .mockReturnValue('network');
    const error = new Error('NETWORK issue');

    const result = testBase.controller._categorizeError(error);

    expect(categorizeSpy).toHaveBeenCalledWith(error);
    expect(result).toBe('network');
  });
});
