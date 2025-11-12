/**
 * @file Unit tests for TurnOrderTickerRenderer
 * Tests class import, constructor validation, and dependency injection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TurnOrderTickerRenderer from '../../../src/domUI/turnOrderTickerRenderer.js';

describe('TurnOrderTickerRenderer - Class Import', () => {
  it('should be importable', () => {
    expect(TurnOrderTickerRenderer).toBeDefined();
    expect(typeof TurnOrderTickerRenderer).toBe('function');
  });
});

describe('TurnOrderTickerRenderer - Constructor', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;

  beforeEach(() => {
    // Create valid mock dependencies
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    mockDocumentContext = {
      query: jest.fn(selector => mockContainer.querySelector(selector)),
      create: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
      unsubscribe: jest.fn(),
    };

    mockDomElementFactory = {
      create: jest.fn(() => document.createElement('div')),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };
  });

  it('should throw if logger is missing', () => {
    expect(() => {
      new TurnOrderTickerRenderer({
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if logger is missing required methods', () => {
    const invalidLogger = { info: jest.fn() }; // Missing warn, error, debug

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: invalidLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if documentContext is missing required methods', () => {
    const invalidDocumentContext = { query: jest.fn() }; // Missing create

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: invalidDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if validatedEventDispatcher is missing required methods', () => {
    const invalidEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      // Missing unsubscribe
    };

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: invalidEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if domElementFactory is missing required methods', () => {
    const invalidDomElementFactory = {}; // Missing create

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: invalidDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if entityManager is missing required methods', () => {
    const invalidEntityManager = { getEntityInstance: jest.fn() }; // Missing hasComponent

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: invalidEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if entityDisplayDataProvider is missing required methods', () => {
    const invalidProvider = { getEntityName: jest.fn() }; // Missing getEntityPortraitPath

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: invalidProvider,
        tickerContainerElement: mockContainer,
      });
    }).toThrow();
  });

  it('should throw if tickerContainerElement is not an HTMLElement', () => {
    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: 'not-an-element',
      });
    }).toThrow('tickerContainerElement must be a valid HTMLElement');
  });

  it('should throw if tickerContainerElement is null', () => {
    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: null,
      });
    }).toThrow('tickerContainerElement must be a valid HTMLElement');
  });

  it('should throw if required child elements are missing', () => {
    const emptyContainer = document.createElement('div');

    mockDocumentContext.query = jest.fn(() => null); // Simulate missing child elements

    expect(() => {
      new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: emptyContainer,
      });
    }).toThrow('Ticker DOM structure missing required child elements');
  });

  it('should initialize successfully with valid dependencies', () => {
    const renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(renderer).toBeDefined();
    expect(renderer).toBeInstanceOf(TurnOrderTickerRenderer);
  });

  it('should log initialization message', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderTickerRenderer initialized');
  });

  it('should subscribe to round_started event', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      'core:round_started',
      expect.any(Function)
    );
  });

  it('should subscribe to turn_started event', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      'core:turn_started',
      expect.any(Function)
    );
  });

  it('should subscribe to turn_ended event', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      'core:turn_ended',
      expect.any(Function)
    );
  });

  it('should subscribe to component_added event', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      'core:component_added',
      expect.any(Function)
    );
  });

  it('should subscribe to exactly 4 events', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(4);
  });

  it('should cache round number element', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockDocumentContext.query).toHaveBeenCalledWith('#ticker-round-number');
  });

  it('should cache actor queue element', () => {
    new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    expect(mockDocumentContext.query).toHaveBeenCalledWith('#ticker-actor-queue');
  });
});

describe('TurnOrderTickerRenderer - Dispose', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let unsubscribeFn1;
  let unsubscribeFn2;
  let unsubscribeFn3;
  let unsubscribeFn4;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    mockDocumentContext = {
      query: jest.fn(selector => mockContainer.querySelector(selector)),
      create: jest.fn(),
    };

    unsubscribeFn1 = jest.fn();
    unsubscribeFn2 = jest.fn();
    unsubscribeFn3 = jest.fn();
    unsubscribeFn4 = jest.fn();

    const unsubscribeFunctions = [unsubscribeFn1, unsubscribeFn2, unsubscribeFn3, unsubscribeFn4];
    let callCount = 0;

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => unsubscribeFunctions[callCount++]),
      unsubscribe: jest.fn(),
    };

    mockDomElementFactory = {
      create: jest.fn(() => document.createElement('div')),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };
  });

  it('should unsubscribe from all events when disposed', () => {
    const renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    renderer.dispose();

    expect(unsubscribeFn1).toHaveBeenCalled();
    expect(unsubscribeFn2).toHaveBeenCalled();
    expect(unsubscribeFn3).toHaveBeenCalled();
    expect(unsubscribeFn4).toHaveBeenCalled();
  });

  it('should log disposal message', () => {
    const renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    renderer.dispose();

    expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderTickerRenderer disposed');
  });

  it('should clear unsubscribe functions array after disposal', () => {
    const renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    renderer.dispose();

    // Call dispose again - should not throw and should not call unsubscribe functions again
    const callsBefore = unsubscribeFn1.mock.calls.length;
    renderer.dispose();
    expect(unsubscribeFn1).toHaveBeenCalledTimes(callsBefore); // No additional calls
  });
});

describe('TurnOrderTickerRenderer - Public API', () => {
  let renderer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    const mockDocumentContext = {
      query: jest.fn(selector => mockContainer.querySelector(selector)),
      create: jest.fn(),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
      unsubscribe: jest.fn(),
    };

    const mockDomElementFactory = {
      create: jest.fn(() => document.createElement('div')),
    };

    const mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should have render method', () => {
    expect(renderer.render).toBeDefined();
    expect(typeof renderer.render).toBe('function');
  });

  it('should have updateCurrentActor method', () => {
    expect(renderer.updateCurrentActor).toBeDefined();
    expect(typeof renderer.updateCurrentActor).toBe('function');
  });

  it('should have removeActor method', () => {
    expect(renderer.removeActor).toBeDefined();
    expect(typeof renderer.removeActor).toBe('function');
  });

  it('should have updateActorParticipation method', () => {
    expect(renderer.updateActorParticipation).toBeDefined();
    expect(typeof renderer.updateActorParticipation).toBe('function');
  });

  it('should have dispose method', () => {
    expect(renderer.dispose).toBeDefined();
    expect(typeof renderer.dispose).toBe('function');
  });

  it('render method should log debug message (stub implementation)', () => {
    renderer.render([]);
    expect(mockLogger.debug).toHaveBeenCalledWith('render() called', { actorCount: 0 });
  });

  it('updateCurrentActor method should log debug message (stub implementation)', () => {
    renderer.updateCurrentActor('test-actor-id');
    expect(mockLogger.debug).toHaveBeenCalledWith('updateCurrentActor() called', {
      entityId: 'test-actor-id',
    });
  });

  it('removeActor method should log debug message (stub implementation)', () => {
    renderer.removeActor('test-actor-id');
    expect(mockLogger.debug).toHaveBeenCalledWith('removeActor() called', {
      entityId: 'test-actor-id',
    });
  });

  it('updateActorParticipation method should log debug message (stub implementation)', () => {
    renderer.updateActorParticipation('test-actor-id', true);
    expect(mockLogger.debug).toHaveBeenCalledWith('updateActorParticipation() called', {
      entityId: 'test-actor-id',
      participating: true,
    });
  });
});

describe('TurnOrderTickerRenderer - Display Data Extraction', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: selector => mockContainer.querySelector(selector),
        create: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        create: jest.fn(() => document.createElement('div')),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should extract name and portrait when both exist', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Alice');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/alice.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer.__testGetActorDisplayData('actor-1');

    expect(result).toEqual({
      name: 'Alice',
      portraitPath: '/path/to/alice.jpg',
      participating: true,
    });
  });

  it('should fallback to entity ID when name missing', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('actor-1');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/portrait.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer.__testGetActorDisplayData('actor-1');

    expect(result.name).toBe('actor-1');
  });

  it('should handle missing portrait gracefully', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Bob');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer.__testGetActorDisplayData('actor-2');

    expect(result).toEqual({
      name: 'Bob',
      portraitPath: null,
      participating: true,
    });
  });

  it('should extract participation status when component exists', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Charlie');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(true);
    mockEntityManager.getComponentData.mockReturnValue({
      participating: false,
    });

    const result = renderer.__testGetActorDisplayData('actor-3');

    expect(result.participating).toBe(false);
  });

  it('should default to participating true when component missing', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Diana');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer.__testGetActorDisplayData('actor-4');

    expect(result.participating).toBe(true);
  });

  it('should handle exception and return fallback', () => {
    mockEntityDisplayDataProvider.getEntityName.mockImplementation(() => {
      throw new Error('Service unavailable');
    });

    const result = renderer.__testGetActorDisplayData('actor-6');

    expect(result).toEqual({
      name: 'actor-6',
      portraitPath: null,
      participating: true,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to extract actor display data, using fallback',
      expect.objectContaining({
        entityId: 'actor-6',
        error: 'Service unavailable',
      })
    );
  });

  it('should log debug information for successful extraction', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Eve');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/eve.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    renderer.__testGetActorDisplayData('actor-7');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor display data extracted',
      expect.objectContaining({
        entityId: 'actor-7',
        name: 'Eve',
        hasPortrait: true,
        participating: true,
      })
    );
  });
});

describe('TurnOrderTickerRenderer - Actor Element Creation', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let mockDomElementFactory;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };

    mockDomElementFactory = {
      create: jest.fn((tag) => document.createElement(tag)),
      div: jest.fn((cls) => {
        const el = document.createElement('div');
        if (cls) el.classList.add(cls);
        return el;
      }),
      span: jest.fn((cls, text) => {
        const el = document.createElement('span');
        if (cls) el.classList.add(cls);
        if (text) el.textContent = text;
        return el;
      }),
      img: jest.fn((src, alt, cls) => {
        const el = document.createElement('img');
        el.src = src;
        el.alt = alt;
        if (cls) el.classList.add(cls);
        return el;
      }),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: (selector) => mockContainer.querySelector(selector),
        create: jest.fn((tag) => document.createElement(tag)),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should create element with portrait when available', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Alice');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/alice.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer.__testCreateActorElement({ id: 'actor-1' });

    expect(element.classList.contains('ticker-actor')).toBe(true);
    expect(element.getAttribute('data-entity-id')).toBe('actor-1');
    expect(element.querySelector('.ticker-actor-portrait')).toBeTruthy();
    expect(element.querySelector('.ticker-actor-portrait').src).toContain('alice.jpg');
    expect(element.querySelector('.ticker-actor-portrait').alt).toBe('Alice');
    expect(element.querySelector('.ticker-actor-name').textContent).toBe('Alice');
  });

  it('should create element with name badge when portrait missing', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Bob');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer.__testCreateActorElement({ id: 'actor-2' });

    expect(element.classList.contains('ticker-actor')).toBe(true);
    expect(element.querySelector('.ticker-actor-portrait')).toBeFalsy();
    expect(element.querySelector('.ticker-actor-name-badge')).toBeTruthy();
    expect(element.querySelector('.ticker-actor-name-badge .ticker-actor-name').textContent).toBe('Bob');
  });

  it('should set participation data attribute', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Charlie');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(true);
    mockEntityManager.getComponentData.mockReturnValue({ participating: false });

    const element = renderer.__testCreateActorElement({ id: 'actor-3' });

    expect(element.getAttribute('data-participating')).toBe('false');
  });

  it('should set lazy loading on portrait images', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Diana');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/diana.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer.__testCreateActorElement({ id: 'actor-4' });
    const img = element.querySelector('.ticker-actor-portrait');

    expect(img.loading).toBe('lazy');
  });

  it('should add title attribute for tooltip', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Very Long Actor Name That Will Be Truncated');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer.__testCreateActorElement({ id: 'actor-5' });
    const nameLabel = element.querySelector('.ticker-actor-name');

    expect(nameLabel.title).toBe('Very Long Actor Name That Will Be Truncated');
  });

  it('should handle image load failure', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Eve');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/invalid.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer.__testCreateActorElement({ id: 'actor-6' });
    const img = element.querySelector('.ticker-actor-portrait');

    // Simulate image error
    img.onerror();

    expect(element.querySelector('.ticker-actor-portrait')).toBeFalsy();
    expect(element.querySelector('.ticker-actor-name-badge')).toBeTruthy();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Portrait failed to load, switching to name badge',
      expect.any(Object)
    );
  });

  it('should throw error if entity has no id', () => {
    expect(() => {
      renderer.__testCreateActorElement({});
    }).toThrow('Entity must have an id property');

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should throw error if entity is null', () => {
    expect(() => {
      renderer.__testCreateActorElement(null);
    }).toThrow('Entity must have an id property');
  });
});
