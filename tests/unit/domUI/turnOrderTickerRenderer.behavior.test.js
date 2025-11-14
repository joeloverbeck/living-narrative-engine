import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TurnOrderTickerRenderer } from '../../../src/domUI/turnOrderTickerRenderer.js';
import { PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const createDomElementFactory = () => ({
  create: jest.fn(tag => document.createElement(tag)),
  div: jest.fn((classNames) => {
    const el = document.createElement('div');
    if (classNames) {
      const classes = Array.isArray(classNames)
        ? classNames
        : String(classNames)
            .split(' ')
            .map(cls => cls.trim())
            .filter(Boolean);
      el.classList.add(...classes);
    }
    return el;
  }),
  span: jest.fn((classNames, textContent) => {
    const el = document.createElement('span');
    if (classNames) {
      const classes = Array.isArray(classNames)
        ? classNames
        : String(classNames)
            .split(' ')
            .map(cls => cls.trim())
            .filter(Boolean);
      el.classList.add(...classes);
    }
    if (textContent !== undefined) {
      el.textContent = textContent;
    }
    return el;
  }),
  img: jest.fn((src = '', alt = '', classNames) => {
    const el = document.createElement('img');
    el.src = src;
    el.alt = alt;
    if (classNames) {
      const classes = Array.isArray(classNames)
        ? classNames
        : String(classNames)
            .split(' ')
            .map(cls => cls.trim())
            .filter(Boolean);
      el.classList.add(...classes);
    }
    return el;
  }),
});

const createRenderer = (overrides = {}) => {
  const logger = overrides.logger ?? {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const container = document.createElement('div');
  container.innerHTML = `
    <span id="ticker-round-number"></span>
    <div id="ticker-actor-queue"></div>
  `;

  const queueElement = container.querySelector('#ticker-actor-queue');
  queueElement.scrollTo = jest.fn();

  const documentContext = {
    query: jest.fn(selector => container.querySelector(selector)),
    create: jest.fn(tag => document.createElement(tag)),
  };

  const domElementFactory = overrides.domElementFactory ?? createDomElementFactory();

  const validatedEventDispatcher = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    unsubscribe: jest.fn(),
  };

  const entityManager = {
    getEntityInstance: jest.fn(),
    hasComponent: jest.fn(() => false),
    getComponentData: jest.fn(() => ({ participating: true })),
  };

  const entityDisplayDataProvider = {
    getEntityName: jest.fn(id => `Actor ${id}`),
    getEntityPortraitPath: jest.fn(() => null),
  };

  const renderer = new TurnOrderTickerRenderer({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    tickerContainerElement: container,
    ...overrides,
  });

  return { renderer, logger, domElementFactory, queueElement };
};

const renderActors = (renderer, ids) => {
  renderer.render(ids.map(id => ({ id })));
};

describe('TurnOrderTickerRenderer advanced behaviors', () => {
  let logger;
  let renderer;
  let domElementFactory;
  let queueElement;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    ({ renderer, logger, domElementFactory, queueElement } = createRenderer());

    Object.values(logger).forEach(mock => mock.mockClear());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs and continues when exit animation throws before promise creation', async () => {
    renderActors(renderer, ['actor-1', 'actor-2']);
    logger.error.mockClear();
    logger.debug.mockClear();

    const originalHTMLElement = global.HTMLElement;

    try {
      // Force instanceof check to throw before the animation promise is created
      // eslint-disable-next-line no-global-assign -- Intentional test override
      HTMLElement = undefined;

      await renderer.removeActor('actor-1');
    } finally {
      // eslint-disable-next-line no-global-assign -- Restore jsdom HTMLElement
      HTMLElement = originalHTMLElement;
    }

    expect(logger.error).toHaveBeenCalledWith(
      'Exit animation failed, performing fallback removal',
      expect.objectContaining({ entityId: 'actor-1' })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Actor removed from ticker',
      expect.objectContaining({ entityId: 'actor-1', remainingActors: 1 })
    );
  });

  it('logs when removal fails after animation completes', async () => {
    renderActors(renderer, ['actor-1']);
    logger.error.mockClear();

    const actorElement = queueElement.querySelector('[data-entity-id="actor-1"]');
    const originalRemove = actorElement.remove;
    actorElement.remove = () => {
      throw new Error('remove failure');
    };

    try {
      const removalPromise = renderer.removeActor('actor-1');
      jest.advanceTimersByTime(600);
      await removalPromise;

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to remove actor from ticker',
        expect.objectContaining({ error: 'remove failure', entityId: 'actor-1' })
      );
    } finally {
      actorElement.remove = originalRemove;
    }
  });

  it('captures errors thrown during participation updates', () => {
    const failingQueue = {
      querySelector: () => {
        throw new Error('query failure');
      },
    };

    renderer.__testSetActorQueueElement(failingQueue);
    logger.error.mockClear();

    try {
      renderer.updateActorParticipation('actor-1', true);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update actor participation state',
        expect.objectContaining({ error: 'query failure' })
      );
    } finally {
      renderer.__testSetActorQueueElement(queueElement);
    }
  });

  it('warns when applyParticipationState receives a non-HTMLElement', () => {
    logger.warn.mockClear();

    renderer.__testApplyParticipationState({}, true);

    expect(logger.warn).toHaveBeenCalledWith(
      'applyParticipationState requires a valid HTMLElement',
      expect.objectContaining({ element: {} })
    );
  });

  it('handles invalid messages in announceToScreenReader', () => {
    renderer.__testAnnounceToScreenReader(null);

    expect(logger.warn).toHaveBeenCalledWith(
      'announceToScreenReader requires a valid message string',
      expect.objectContaining({ message: null })
    );
  });

  it('creates and removes screen reader announcements', () => {
    renderer.__testAnnounceToScreenReader('Next actor');

    expect(document.body.querySelectorAll('.sr-only').length).toBe(1);

    jest.advanceTimersByTime(1000);

    expect(document.body.querySelector('.sr-only')).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith('Screen reader announcement removed');
  });

  it('logs when announcement creation fails', () => {
    const originalAppendChild = document.body.appendChild;
    document.body.appendChild = () => {
      throw new Error('append failure');
    };

    try {
      renderer.__testAnnounceToScreenReader('Broken DOM');

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to create screen reader announcement',
        expect.objectContaining({ error: 'append failure' })
      );
    } finally {
      document.body.appendChild = originalAppendChild;
    }
  });

  it('warns when actor entry cleanup fails', () => {
    const element = document.createElement('div');
    element.classList.add('ticker-actor');
    const originalRemove = element.classList.remove;
    element.classList.remove = () => {
      throw new Error('cleanup failure');
    };

    try {
      renderer.__testAnimateActorEntry(element, 2);
      jest.advanceTimersByTime(1000);

      expect(logger.warn).toHaveBeenCalledWith(
        'TurnOrderTickerRenderer: Failed to clean up after actor entry animation',
        expect.objectContaining({ error: 'cleanup failure', index: 2 })
      );
    } finally {
      element.classList.remove = originalRemove;
    }
  });

  it('resolves exit animation when animationend fires', async () => {
    const element = document.createElement('div');
    element.setAttribute('data-entity-id', 'actor-99');

    const exitPromise = renderer.__testAnimateActorExit(element);
    element.dispatchEvent(new Event('animationend'));

    await exitPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'Exit animation completed',
      expect.objectContaining({ entityId: 'actor-99' })
    );
  });

  it('skips render empty queue work when queue element is missing', () => {
    renderer.__testSetActorQueueElement(null);
    domElementFactory.create.mockClear();

    try {
      renderer.__testRenderEmptyQueue();

      expect(domElementFactory.create).not.toHaveBeenCalled();
    } finally {
      renderer.__testSetActorQueueElement(queueElement);
    }
  });

  it('logs errors from handleRoundStarted', () => {
    const error = new Error('render failure');
    const renderSpy = jest.spyOn(renderer, 'render').mockImplementation(() => {
      throw error;
    });

    renderer.__testHandleRoundStarted({
      payload: { roundNumber: 1, actors: ['actor-1'] },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to handle round_started event',
      expect.objectContaining({ error: error.message })
    );

    renderSpy.mockRestore();
  });

  it('logs errors from handleTurnStarted', () => {
    const error = new Error('highlight failure');
    const spy = jest.spyOn(renderer, 'updateCurrentActor').mockImplementation(() => {
      throw error;
    });

    renderer.__testHandleTurnStarted({
      payload: { entityId: 'actor-1', entityType: 'player' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to handle turn_started event',
      expect.objectContaining({ error: error.message })
    );

    spy.mockRestore();
  });

  it('logs errors from handleTurnEnded', async () => {
    const error = new Error('removal failure');
    const spy = jest.spyOn(renderer, 'removeActor').mockRejectedValue(error);

    await renderer.__testHandleTurnEnded({
      payload: { entityId: 'actor-1' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to handle turn_ended event',
      expect.objectContaining({ error: error.message })
    );

    spy.mockRestore();
  });

  it('logs errors from handleParticipationChanged', () => {
    const error = new Error('update failure');
    const spy = jest
      .spyOn(renderer, 'updateActorParticipation')
      .mockImplementation(() => {
        throw error;
      });

    renderer.__testHandleParticipationChanged({
      payload: {
        entityId: 'actor-1',
        componentId: PARTICIPATION_COMPONENT_ID,
        data: { participating: true },
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to handle participation change event',
      expect.objectContaining({ error: error.message })
    );

    spy.mockRestore();
  });
});
