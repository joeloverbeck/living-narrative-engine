import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { registerWithLog } from '../../../src/utils/registrarHelpers.js';
import { TurnOrderTickerRenderer } from '../../../src/domUI/turnOrderTickerRenderer.js';

describe('TurnOrderTickerRenderer DI Registration', () => {
  let container;
  let registrar;
  let mockLogger;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="turn-order-ticker">
        <span id="ticker-round-number">ROUND 1</span>
        <div id="ticker-actor-queue"></div>
      </div>
    `;

    container = new AppContainer();
    registrar = new Registrar(container);

    // Register mock dependencies
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    registrar.instance(tokens.ILogger, mockLogger);

    const mockDocumentContext = {
      query: (selector) => document.querySelector(selector),
      create: jest.fn((tag) => document.createElement(tag)),
    };
    registrar.instance(tokens.IDocumentContext, mockDocumentContext);

    registrar.instance(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => 'sub-id'),
      unsubscribe: jest.fn(),
    });

    registrar.instance(tokens.DomElementFactory, {
      create: jest.fn((tag) => document.createElement(tag)),
    });

    registrar.instance(tokens.IEntityManager, {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    });

    registrar.instance(tokens.EntityDisplayDataProvider, {
      getEntityName: jest.fn(() => 'Test Actor'),
      getEntityPortraitPath: jest.fn(() => '/path/to/portrait.png'),
    });

    // Register TurnOrderTickerRenderer using actual pattern
    registerWithLog(
      registrar,
      tokens.TurnOrderTickerRenderer,
      (c) => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const resolvedLogger = c.resolve(tokens.ILogger);
        const tickerContainerElement = docContext.query('#turn-order-ticker');

        if (!tickerContainerElement) {
          resolvedLogger.error(
            'UI Registrations: Could not find #turn-order-ticker element for TurnOrderTickerRenderer.'
          );
          throw new Error('Required DOM element #turn-order-ticker not found');
        }

        return new TurnOrderTickerRenderer({
          logger: resolvedLogger,
          documentContext: docContext,
          validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
          domElementFactory: c.resolve(tokens.DomElementFactory),
          entityManager: c.resolve(tokens.IEntityManager),
          entityDisplayDataProvider: c.resolve(tokens.EntityDisplayDataProvider),
          tickerContainerElement,
        });
      },
      { lifecycle: 'singletonFactory' },
      mockLogger
    );
  });

  it('should register TurnOrderTickerRenderer token', () => {
    expect(container.isRegistered(tokens.TurnOrderTickerRenderer)).toBe(true);
  });

  it('should resolve TurnOrderTickerRenderer instance', () => {
    const renderer = container.resolve(tokens.TurnOrderTickerRenderer);

    expect(renderer).toBeDefined();
    expect(renderer.constructor.name).toBe('TurnOrderTickerRenderer');
  });

  it('should throw if ticker container element not found', () => {
    // Remove element from DOM
    document.body.innerHTML = '';

    // Create new container without element
    const newContainer = new AppContainer();
    const newRegistrar = new Registrar(newContainer);

    // Re-register dependencies
    newRegistrar.instance(tokens.ILogger, mockLogger);
    newRegistrar.instance(tokens.IDocumentContext, {
      query: () => null, // Element not found
      create: jest.fn(),
    });

    registerWithLog(
      newRegistrar,
      tokens.TurnOrderTickerRenderer,
      (c) => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const resolvedLogger = c.resolve(tokens.ILogger);
        const tickerContainerElement = docContext.query('#turn-order-ticker');

        if (!tickerContainerElement) {
          resolvedLogger.error(
            'UI Registrations: Could not find #turn-order-ticker element for TurnOrderTickerRenderer.'
          );
          throw new Error('Required DOM element #turn-order-ticker not found');
        }

        return new TurnOrderTickerRenderer({
          logger: resolvedLogger,
          documentContext: docContext,
          validatedEventDispatcher: { subscribe: jest.fn(), unsubscribe: jest.fn() },
          domElementFactory: { create: jest.fn() },
          entityManager: { getEntityInstance: jest.fn(), hasComponent: jest.fn() },
          entityDisplayDataProvider: {
            getEntityName: jest.fn(),
            getEntityPortraitPath: jest.fn(),
          },
          tickerContainerElement,
        });
      },
      { lifecycle: 'singletonFactory' },
      mockLogger
    );

    expect(() => {
      newContainer.resolve(tokens.TurnOrderTickerRenderer);
    }).toThrow('Required DOM element #turn-order-ticker not found');
  });

  it('should inject all dependencies correctly', () => {
    const renderer = container.resolve(tokens.TurnOrderTickerRenderer);

    expect(renderer).toBeDefined();
    expect(typeof renderer.dispose).toBe('function');
    expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderTickerRenderer initialized');
  });
});
