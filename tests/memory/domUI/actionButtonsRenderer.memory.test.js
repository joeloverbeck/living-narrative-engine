/**
 * @file ActionButtonsRenderer Memory Tests
 * Validates memory usage and leak prevention
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import ActionCategorizationService from '../../../src/entities/utils/ActionCategorizationService.js';
import { UI_CATEGORIZATION_CONFIG } from '../../../src/entities/utils/actionCategorizationConfig.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { JSDOM } from 'jsdom';

describe('ActionButtonsRenderer Memory Validation', () => {
  let container;
  let renderer;
  let dom;
  let document;
  let documentContext;

  beforeEach(() => {
    // Set up DOM
    dom = new JSDOM('<!DOCTYPE html><div id="actions-container"></div>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    documentContext = new DocumentContext(document);

    // Create container with services
    container = new AppContainer();
    const logger = new ConsoleLogger();
    container.register(tokens.ILogger, logger);
    container.register(
      tokens.IActionCategorizationService,
      new ActionCategorizationService({
        logger: logger,
        config: UI_CATEGORIZATION_CONFIG,
      })
    );

    const mockEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    const domElementFactory = new DomElementFactory({
      logger: logger,
      documentContext: documentContext,
    });

    renderer = new ActionButtonsRenderer({
      logger: logger,
      documentContext: documentContext,
      validatedEventDispatcher: mockEventDispatcher,
      domElementFactory: domElementFactory,
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: container.resolve(
        tokens.IActionCategorizationService
      ),
    });
  });

  afterEach(() => {
    if (renderer && renderer.dispose) {
      renderer.dispose();
    }
    if (container && container.dispose) {
      container.dispose();
    }
  });

  it('should not degrade memory usage', () => {
    const actions = Array.from({ length: 100 }, (_, i) => ({
      index: i + 1,
      actionId: `test:action${i}`,
      commandString: `command ${i}`,
      description: `Description ${i}`,
    }));

    const service = container.resolve(tokens.IActionCategorizationService);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many operations
    for (let i = 0; i < 100; i++) {
      service.shouldUseGrouping(actions);
      service.groupActionsByNamespace(actions);
    }

    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be minimal (less than 1MB)
    expect(memoryIncrease).toBeLessThan(1024 * 1024);
  });
});
