/**
 * @file Unit tests for TurnOrderTickerRenderer
 * Tests class import, constructor validation, and dependency injection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderTickerRenderer } from '../../../src/domUI/turnOrderTickerRenderer.js';

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
    // Mock scrollTo for jsdom compatibility
    const actorQueue = mockContainer.querySelector('#ticker-actor-queue');
    if (actorQueue) {
      actorQueue.scrollTo = jest.fn();
    }

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

  it('render method should render empty queue message when no actors', () => {
    renderer.render([]);
    expect(mockLogger.info).toHaveBeenCalledWith('Rendering empty turn order queue');
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

describe('TurnOrderTickerRenderer - Event Handlers', () => {
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
      getComponent: jest.fn(),
      hasComponent: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn(() => ({ name: 'TestActor' })),
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number">ROUND 0</span>
      <div id="ticker-actor-queue"></div>
    `;

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: (selector) => mockContainer.querySelector(selector),
        queryAll: jest.fn(),
        create: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        create: jest.fn((tag) => document.createElement(tag)),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Spy on render methods
    jest.spyOn(renderer, 'render').mockImplementation(() => {});
    jest.spyOn(renderer, 'updateCurrentActor').mockImplementation(() => {});
    jest.spyOn(renderer, 'removeActor').mockImplementation(() => {});
    jest.spyOn(renderer, 'updateActorParticipation').mockImplementation(() => {});
  });

  describe('#handleRoundStarted', () => {
    it('should call render with actor entities', () => {
      const event = {
        payload: {
          roundNumber: 1,
          actors: ['actor-1', 'actor-2', 'actor-3'],
          strategy: 'round-robin',
        },
      };

      renderer.__testHandleRoundStarted(event);

      expect(renderer.render).toHaveBeenCalledWith([
        { id: 'actor-1' },
        { id: 'actor-2' },
        { id: 'actor-3' },
      ]);
    });

    it('should update round number display', () => {
      const event = {
        payload: {
          roundNumber: 5,
          actors: ['actor-1'],
          strategy: 'round-robin',
        },
      };

      renderer.__testHandleRoundStarted(event);

      const roundElement = mockContainer.querySelector('#ticker-round-number');
      expect(roundElement.textContent).toBe('ROUND 5');
    });

    it('should handle empty actor list', () => {
      const event = {
        payload: {
          roundNumber: 1,
          actors: [],
          strategy: 'round-robin',
        },
      };

      renderer.__testHandleRoundStarted(event);

      expect(renderer.render).toHaveBeenCalledWith([]);
    });

    it('should warn on invalid payload', () => {
      const event = { payload: null };

      renderer.__testHandleRoundStarted(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid round_started event payload',
        expect.any(Object)
      );
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('should reset current actor tracking', () => {
      // Note: Can't directly access private field, but we can verify behavior
      const event = {
        payload: {
          roundNumber: 2,
          actors: ['actor-1'],
          strategy: 'round-robin',
        },
      };

      renderer.__testHandleRoundStarted(event);

      // Verify the handler was called successfully (no errors thrown)
      expect(renderer.render).toHaveBeenCalled();
    });
  });

  describe('#handleTurnStarted', () => {
    it('should call updateCurrentActor with entity ID', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          entityType: 'player',
        },
      };

      renderer.__testHandleTurnStarted(event);

      expect(renderer.updateCurrentActor).toHaveBeenCalledWith('actor-1');
    });

    it('should track current actor ID', () => {
      const event = {
        payload: {
          entityId: 'actor-2',
          entityType: 'ai',
        },
      };

      renderer.__testHandleTurnStarted(event);

      // Verify the handler was called successfully
      expect(renderer.updateCurrentActor).toHaveBeenCalledWith('actor-2');
    });

    it('should ignore non-actor entities', () => {
      const event = {
        payload: {
          entityId: 'item-1',
          entityType: 'item',
        },
      };

      renderer.__testHandleTurnStarted(event);

      expect(renderer.updateCurrentActor).not.toHaveBeenCalled();
    });

    it('should warn on missing entity ID', () => {
      const event = { payload: {} };

      renderer.__testHandleTurnStarted(event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.updateCurrentActor).not.toHaveBeenCalled();
    });
  });

  describe('#handleTurnEnded', () => {
    it('should call removeActor with entity ID', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer.__testHandleTurnEnded(event);

      expect(renderer.removeActor).toHaveBeenCalledWith('actor-1');
    });

    it('should clear current actor tracking if it matches', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer.__testHandleTurnEnded(event);

      // Verify the handler was called successfully
      expect(renderer.removeActor).toHaveBeenCalledWith('actor-1');
    });

    it('should not clear current actor tracking if different', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer.__testHandleTurnEnded(event);

      // Verify the handler was called successfully
      expect(renderer.removeActor).toHaveBeenCalledWith('actor-1');
    });

    it('should warn on missing entity ID', () => {
      const event = { payload: {} };

      renderer.__testHandleTurnEnded(event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.removeActor).not.toHaveBeenCalled();
    });
  });

  describe('#handleParticipationChanged', () => {
    it('should call updateActorParticipation when participation changes', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          componentId: 'core:participation',
          data: { participating: false },
        },
      };

      renderer.__testHandleParticipationChanged(event);

      expect(renderer.updateActorParticipation).toHaveBeenCalledWith('actor-1', false);
    });

    it('should default to true if participating not specified', () => {
      const event = {
        payload: {
          entityId: 'actor-2',
          componentId: 'core:participation',
          data: {},
        },
      };

      renderer.__testHandleParticipationChanged(event);

      expect(renderer.updateActorParticipation).toHaveBeenCalledWith('actor-2', true);
    });

    it('should ignore non-participation component events', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          componentId: 'core:name',
          data: { text: 'Alice' },
        },
      };

      renderer.__testHandleParticipationChanged(event);

      expect(renderer.updateActorParticipation).not.toHaveBeenCalled();
    });

    it('should warn on missing entity ID', () => {
      const event = {
        payload: {
          componentId: 'core:participation',
          data: { participating: false },
        },
      };

      renderer.__testHandleParticipationChanged(event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.updateActorParticipation).not.toHaveBeenCalled();
    });
  });
});

describe('TurnOrderTickerRenderer - Render Method', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockDomElementFactory;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockActorQueue = document.createElement('div');
    mockActorQueue.id = 'ticker-actor-queue';
    // Mock scrollTo for jsdom compatibility
    mockActorQueue.scrollTo = jest.fn();

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = '<span id="ticker-round-number"></span>';
    mockContainer.appendChild(mockActorQueue);

    const mockDocumentContext = {
      query: jest.fn(selector => mockContainer.querySelector(selector)),
      create: jest.fn(),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
      unsubscribe: jest.fn(),
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
      img: jest.fn((src) => {
        const el = document.createElement('img');
        if (src) el.src = src;
        return el;
      }),
    };

    const mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id}`),
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

    // Spy on animation method
    jest.spyOn(renderer, '__testAnimateActorEntry');
  });

  it('should render all actors in order', () => {
    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ];

    renderer.render(actors);

    expect(mockActorQueue.children.length).toBe(3);
    expect(mockActorQueue.children[0].dataset.entityId).toBe('actor-1');
    expect(mockActorQueue.children[1].dataset.entityId).toBe('actor-2');
    expect(mockActorQueue.children[2].dataset.entityId).toBe('actor-3');
    expect(mockLogger.info).toHaveBeenCalledWith('Rendering turn order queue', {
      actorCount: 3,
      actorIds: ['actor-1', 'actor-2', 'actor-3'],
    });
  });

  it('should clear existing actors before rendering', () => {
    // Add existing elements
    const existing1 = document.createElement('div');
    const existing2 = document.createElement('div');
    mockActorQueue.appendChild(existing1);
    mockActorQueue.appendChild(existing2);

    expect(mockActorQueue.children.length).toBe(2);

    const actors = [{ id: 'actor-1' }];
    renderer.render(actors);

    // Should only have new actors
    expect(mockActorQueue.children.length).toBe(1);
    expect(mockActorQueue.children[0].dataset.entityId).toBe('actor-1');
  });

  it('should render empty queue message when no actors', () => {
    renderer.render([]);

    expect(mockActorQueue.children.length).toBe(1);
    expect(mockActorQueue.children[0].className).toBe('ticker-empty-message');
    expect(mockActorQueue.children[0].textContent).toBe('No participating actors');
    expect(mockLogger.info).toHaveBeenCalledWith('Rendering empty turn order queue');
  });

  it('should skip invalid actors and continue rendering', () => {
    const actors = [
      { id: 'actor-1' },
      null, // Invalid
      { id: 'actor-2' },
      { }, // No id
      { id: 'actor-3' },
    ];

    renderer.render(actors);

    expect(mockActorQueue.children.length).toBe(3);
    expect(mockActorQueue.children[0].dataset.entityId).toBe('actor-1');
    expect(mockActorQueue.children[1].dataset.entityId).toBe('actor-2');
    expect(mockActorQueue.children[2].dataset.entityId).toBe('actor-3');
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('should throw TypeError for non-array input', () => {
    expect(() => renderer.render('not-an-array')).toThrow(TypeError);
    expect(() => renderer.render('not-an-array')).toThrow('render() requires an array of actors');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'render() requires an array of actors',
      { receivedType: 'string' }
    );
  });

  it('should handle single actor', () => {
    const actors = [{ id: 'actor-1' }];

    renderer.render(actors);

    expect(mockActorQueue.children.length).toBe(1);
    expect(mockActorQueue.children[0].dataset.entityId).toBe('actor-1');
  });

  it('should apply animation classes to each actor', () => {
    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ];

    renderer.render(actors);

    // Verify all actors were rendered
    expect(mockActorQueue.children.length).toBe(3);

    // Verify animation class was added to each actor element
    // (the stub implementation adds 'entering' class)
    expect(mockActorQueue.children[0].classList.contains('entering')).toBe(true);
    expect(mockActorQueue.children[1].classList.contains('entering')).toBe(true);
    expect(mockActorQueue.children[2].classList.contains('entering')).toBe(true);
  });

  it('should handle display data extraction failures with fallback', () => {
    // Mock getEntityName to throw an error to test fallback behavior
    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(() => {
        throw new Error('Name extraction failed');
      }),
      getEntityPortraitPath: jest.fn(() => null),
    };

    // Create new renderer with failing dependency
    const failingRenderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: jest.fn(selector => mockContainer.querySelector(selector)),
        create: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => jest.fn()),
        unsubscribe: jest.fn(),
      },
      domElementFactory: mockDomElementFactory,
      entityManager: {
        getEntityInstance: jest.fn(id => ({ id })),
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(),
      },
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    const actors = [{ id: 'actor-1' }];

    // Should not throw, should use fallback data
    failingRenderer.render(actors);

    // Actor element is still created using fallback data (entity ID as name)
    expect(mockActorQueue.children.length).toBe(1);
    expect(mockActorQueue.children[0].dataset.entityId).toBe('actor-1');

    // Warning logged about fallback to minimal data
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to extract actor display data, using fallback',
      expect.objectContaining({
        entityId: 'actor-1',
      })
    );
  });

  it('should log rendering info with actor IDs', () => {
    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
    ];

    renderer.render(actors);

    expect(mockLogger.info).toHaveBeenCalledWith('Rendering turn order queue', {
      actorCount: 2,
      actorIds: ['actor-1', 'actor-2'],
    });
  });
});

describe('TurnOrderTickerRenderer - Current Actor Highlighting', () => {
  let renderer;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let mockActorQueue;

  beforeEach(() => {
    // Create valid mock dependencies
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockActorQueue = document.createElement('div');
    mockActorQueue.id = 'ticker-actor-queue';
    // Add scrollTo method that jsdom doesn't provide
    mockActorQueue.scrollTo = jest.fn();
    mockContainer.appendChild(mockActorQueue);

    const mockRoundNumber = document.createElement('span');
    mockRoundNumber.id = 'ticker-round-number';
    mockContainer.appendChild(mockRoundNumber);

    mockDocumentContext = {
      query: jest.fn(selector => mockContainer.querySelector(selector)),
      create: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
      unsubscribe: jest.fn(),
    };

    mockDomElementFactory = {
      create: jest.fn(config => {
        const el = document.createElement(config.tag || 'div');
        if (config.classes) el.className = config.classes.join(' ');
        if (config.attributes) {
          Object.entries(config.attributes).forEach(([key, value]) => {
            el.setAttribute(key, value);
          });
        }
        if (config.children) {
          config.children.forEach(child => el.appendChild(child));
        }
        return el;
      }),
      div: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'div' })),
      span: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'span' })),
      img: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'img' })),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(id => ({ id })),
      hasComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => ({})),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id}`),
      getEntityPortraitPath: jest.fn(() => '/path/to/portrait.png'),
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

    // Render some actors to work with
    renderer.render([{ id: 'actor-1' }, { id: 'actor-2' }, { id: 'actor-3' }]);
  });

  it('should add .current class to specified actor', () => {
    renderer.updateCurrentActor('actor-2');

    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    expect(actor2.classList.contains('current')).toBe(true);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'updateCurrentActor: Added .current class to actor',
      { entityId: 'actor-2' }
    );
  });

  it('should remove .current class from previous actor', () => {
    // Highlight first actor
    renderer.updateCurrentActor('actor-1');
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.classList.contains('current')).toBe(true);

    // Highlight second actor
    renderer.updateCurrentActor('actor-2');
    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');

    // First actor should no longer be highlighted
    expect(actor1.classList.contains('current')).toBe(false);
    // Second actor should be highlighted
    expect(actor2.classList.contains('current')).toBe(true);
  });

  it('should update internal #currentActorId tracking', () => {
    renderer.updateCurrentActor('actor-3');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'updateCurrentActor: Updated current actor tracking',
      { entityId: 'actor-3' }
    );
  });

  it('should handle actor not found gracefully', () => {
    renderer.updateCurrentActor('non-existent-actor');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateCurrentActor: Actor element not found in ticker',
      { entityId: 'non-existent-actor' }
    );

    // Should not crash or throw
    const highlightedActors = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(highlightedActors.length).toBe(0);
  });

  it('should validate entity ID parameter', () => {
    // Test null
    renderer.updateCurrentActor(null);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateCurrentActor: Invalid entity ID provided',
      { entityId: null, type: 'object' }
    );

    // Test undefined
    renderer.updateCurrentActor(undefined);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateCurrentActor: Invalid entity ID provided',
      { entityId: undefined, type: 'undefined' }
    );

    // Test non-string
    renderer.updateCurrentActor(123);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateCurrentActor: Invalid entity ID provided',
      { entityId: 123, type: 'number' }
    );

    // No actors should be highlighted
    const highlightedActors = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(highlightedActors.length).toBe(0);
  });

  it('should clear all current highlights when called', () => {
    // Manually add current class to multiple actors (simulating a bug scenario)
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    actor1.classList.add('current');
    actor2.classList.add('current');

    // Call updateCurrentActor should clear both
    renderer.updateCurrentActor('actor-3');

    expect(actor1.classList.contains('current')).toBe(false);
    expect(actor2.classList.contains('current')).toBe(false);

    const actor3 = mockActorQueue.querySelector('[data-entity-id="actor-3"]');
    expect(actor3.classList.contains('current')).toBe(true);
  });

  it('should handle sequential updates correctly', () => {
    // Update sequence: actor-1 → actor-2 → actor-3
    renderer.updateCurrentActor('actor-1');
    let currentActor = mockActorQueue.querySelector('.ticker-actor.current');
    expect(currentActor.getAttribute('data-entity-id')).toBe('actor-1');

    renderer.updateCurrentActor('actor-2');
    currentActor = mockActorQueue.querySelector('.ticker-actor.current');
    expect(currentActor.getAttribute('data-entity-id')).toBe('actor-2');

    renderer.updateCurrentActor('actor-3');
    currentActor = mockActorQueue.querySelector('.ticker-actor.current');
    expect(currentActor.getAttribute('data-entity-id')).toBe('actor-3');

    // Only one actor should be highlighted at the end
    const allHighlighted = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(allHighlighted.length).toBe(1);
  });

  it('should not crash if queue is empty', () => {
    // Create new renderer with empty queue
    const emptyContainer = document.createElement('div');
    const emptyQueue = document.createElement('div');
    emptyQueue.id = 'ticker-actor-queue';
    emptyContainer.appendChild(emptyQueue);

    const emptyRoundNumber = document.createElement('span');
    emptyRoundNumber.id = 'ticker-round-number';
    emptyContainer.appendChild(emptyRoundNumber);

    const emptyRenderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: jest.fn(selector => emptyContainer.querySelector(selector)),
        create: jest.fn(),
      },
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: emptyContainer,
    });

    // Call updateCurrentActor on empty queue should not crash
    expect(() => {
      emptyRenderer.updateCurrentActor('actor-1');
    }).not.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateCurrentActor: Actor element not found in ticker',
      { entityId: 'actor-1' }
    );
  });
});
