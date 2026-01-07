import ExpressionsSimulatorController from '../../../src/domUI/expressions-simulator/ExpressionsSimulatorController.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const buildContainer = () => {
  document.body.innerHTML = `
    <div id="expressions-simulator-container">
      <div id="es-mood-inputs"></div>
      <div id="es-mood-derived"></div>
      <div id="es-sexual-inputs"></div>
      <div id="es-sexual-derived"></div>
      <button id="es-record-button" type="button"></button>
      <div id="es-recorded-state-display"></div>
      <div id="es-expression-total"></div>
      <button id="es-trigger-button" type="button"></button>
      <ul id="es-matching-list"></ul>
      <div id="es-selected-expression"></div>
      <div id="es-actor-message"></div>
      <div id="es-observer-message"></div>
      <div id="es-evaluation-count"></div>
      <div id="es-evaluation-log"></div>
    </div>
  `;
};

const createEventBusStub = () => {
  const listeners = new Map();
  return {
    subscribe: jest.fn((eventName, listener) => {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName).add(listener);
      return () => listeners.get(eventName)?.delete(listener);
    }),
    dispatch: jest.fn(async (eventName, payload) => {
      const event = { type: eventName, payload };
      const eventListeners = listeners.get(eventName) ?? new Set();
      await Promise.all(
        Array.from(eventListeners).map(async (listener) => listener(event))
      );
    }),
  };
};

const createEntityManagerStub = () => {
  const components = new Map();
  const entityComponents = new Map();
  const entities = new Set();
  let idCounter = 0;

  const getKey = (entityId, componentId) => `${entityId}:${componentId}`;
  const registerComponent = (entityId, componentId, data) => {
    entities.add(entityId);
    components.set(getKey(entityId, componentId), data);
    if (!entityComponents.has(entityId)) {
      entityComponents.set(entityId, new Set());
    }
    entityComponents.get(entityId).add(componentId);
  };

  return {
    createEntityInstance: jest.fn(async (_definitionId, options = {}) => {
      const id = options.instanceId ?? `entity-${idCounter++}`;
      entities.add(id);
      if (options.componentOverrides) {
        for (const [componentId, data] of Object.entries(
          options.componentOverrides
        )) {
          registerComponent(id, componentId, data);
        }
      }
      return { id };
    }),
    addComponent: jest.fn(async (entityId, componentId, data) => {
      registerComponent(entityId, componentId, data);
      return true;
    }),
    getComponentData: jest.fn((entityId, componentId) => {
      return components.get(getKey(entityId, componentId)) ?? null;
    }),
    getEntityInstance: jest.fn((entityId) => {
      return entities.has(entityId) ? { id: entityId } : null;
    }),
    getAllComponentTypesForEntity: jest.fn((entityId) => {
      return Array.from(entityComponents.get(entityId) ?? []);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      return Boolean(entityComponents.get(entityId)?.has(componentId));
    }),
    hasEntity: jest.fn((entityId) => entities.has(entityId)),
  };
};

const buildDependencies = ({
  moodSchema,
  sexualSchema,
  emotionOverrides,
  expressionRegistryOverrides,
  expressionContextBuilder,
  expressionEvaluatorService,
  expressionDispatcher,
  eventBus,
  perceptionEntryBuilder,
  entityManager,
  entityDefinition,
  locationDefinition,
} = {}) => {
  const moodComponent = moodSchema
    ? { id: 'core:mood', dataSchema: moodSchema }
    : null;
  const sexualComponent = sexualSchema
    ? { id: 'core:sexual_state', dataSchema: sexualSchema }
    : null;

  const entityDefinitions = new Map();
  if (entityDefinition) {
    entityDefinitions.set(entityDefinition.id, entityDefinition);
  }
  if (locationDefinition) {
    entityDefinitions.set(locationDefinition.id, locationDefinition);
  }

  const dataRegistry = {
    get: jest.fn((type, id) => {
      if (type === 'entityDefinitions') {
        return entityDefinitions.get(id);
      }
      if (type !== 'components') {
        return undefined;
      }
      if (id === 'core:mood') {
        return moodComponent;
      }
      if (id === 'core:sexual_state') {
        return sexualComponent;
      }
      return undefined;
    }),
    store: jest.fn((type, id, data) => {
      if (type === 'entityDefinitions') {
        entityDefinitions.set(id, data);
      }
      return false;
    }),
  };

  const emotionCalculatorService = {
    calculateEmotions: jest.fn().mockReturnValue({}),
    formatEmotionsForPrompt: jest.fn().mockReturnValue('neutral'),
    getTopEmotions: jest.fn().mockReturnValue([]),
    calculateSexualArousal: jest.fn().mockReturnValue(0),
    calculateSexualStates: jest.fn().mockReturnValue({}),
    formatSexualStatesForPrompt: jest.fn().mockReturnValue('neutral'),
    getTopSexualStates: jest.fn().mockReturnValue([]),
    ...emotionOverrides,
  };

  const defaultEventBus = createEventBusStub();

  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    dataRegistry,
    entityManager: entityManager ?? createEntityManagerStub(),
    emotionCalculatorService,
    expressionRegistry: {
      getAllExpressions: jest.fn().mockReturnValue([]),
      ...expressionRegistryOverrides,
    },
    expressionContextBuilder:
      expressionContextBuilder ??
      ({
        buildContext: jest.fn().mockReturnValue({
          emotions: {},
          sexualStates: {},
          moodAxes: {},
        }),
      }),
    expressionEvaluatorService:
      expressionEvaluatorService ??
      ({
        evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
          matches: [],
          evaluations: [],
        }),
      }),
    expressionDispatcher:
      expressionDispatcher ??
      ({
        dispatch: jest.fn().mockResolvedValue(false),
      }),
    eventBus: eventBus ?? defaultEventBus,
    perceptionEntryBuilder:
      perceptionEntryBuilder ??
      ({
        buildForRecipient: jest.fn().mockReturnValue({
          descriptionText: 'message',
        }),
      }),
  };
};

describe('ExpressionsSimulatorController', () => {
  beforeEach(() => {
    buildContainer();
  });

  it('renders inputs with schema min/max/default values', () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 5,
          description: 'Pleasant (+) to unpleasant (-).',
        },
      },
    };
    const sexualSchema = {
      properties: {
        baseline_libido: {
          minimum: -50,
          maximum: 50,
          default: 10,
          description: 'Trait-level sexual drive modifier.',
        },
      },
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ moodSchema, sexualSchema })
    );
    controller.initialize();

    const moodRange = document.getElementById(
      'es-input-core-mood-valence-range'
    );
    const moodNumber = document.getElementById(
      'es-input-core-mood-valence-number'
    );
    const sexualRange = document.getElementById(
      'es-input-core-sexual_state-baseline_libido-range'
    );
    const sexualNumber = document.getElementById(
      'es-input-core-sexual_state-baseline_libido-number'
    );

    expect(moodRange).not.toBeNull();
    expect(moodRange.min).toBe('-100');
    expect(moodRange.max).toBe('100');
    expect(moodRange.value).toBe('5');
    expect(moodNumber.value).toBe('5');

    expect(sexualRange).not.toBeNull();
    expect(sexualRange.min).toBe('-50');
    expect(sexualRange.max).toBe('50');
    expect(sexualRange.value).toBe('10');
    expect(sexualNumber.value).toBe('10');
  });

  it('stores runtime entity definitions when missing', async () => {
    const dependencies = buildDependencies();
    const controller = new ExpressionsSimulatorController(dependencies);

    controller.initialize();
    await flushPromises();

    expect(dependencies.dataRegistry.store).toHaveBeenCalledTimes(2);

    const storedDefinitions = dependencies.dataRegistry.store.mock.calls.map(
      ([type, id, definition]) => ({ type, id, definition })
    );

    const simulatorDefinition = storedDefinitions.find(
      (entry) => entry.id === 'core:expression_simulator_entity'
    );
    const locationDefinition = storedDefinitions.find(
      (entry) => entry.id === 'sim:expression_lab'
    );

    expect(simulatorDefinition.type).toBe('entityDefinitions');
    expect(simulatorDefinition.definition).toBeInstanceOf(EntityDefinition);
    expect(simulatorDefinition.definition.hasComponent('core:actor')).toBe(
      true
    );
    expect(locationDefinition.type).toBe('entityDefinitions');
    expect(locationDefinition.definition).toBeInstanceOf(EntityDefinition);
    expect(
      locationDefinition.definition.hasComponent('locations:sensorial_links')
    ).toBe(true);
  });

  it('creates a location entity instance for simulator position', async () => {
    const dependencies = buildDependencies();
    const controller = new ExpressionsSimulatorController(dependencies);

    controller.initialize();
    await flushPromises();

    expect(dependencies.entityManager.createEntityInstance).toHaveBeenCalledWith(
      'sim:expression_lab',
      { instanceId: 'sim:expression_lab' }
    );
  });

  it('updates derived text when inputs change', () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 0,
          description: 'Pleasant (+) to unpleasant (-).',
        },
      },
    };
    const sexualSchema = {
      properties: {
        sex_excitation: {
          minimum: 0,
          maximum: 100,
          default: 0,
          description: 'Sexual response activation.',
        },
      },
    };

    const emotionOverrides = {
      calculateEmotions: jest.fn((moodData) => ({ ...moodData })),
      getTopEmotions: jest.fn((emotions) => [
        {
          displayName: 'Valence',
          label: String(emotions.valence),
        },
      ]),
      calculateSexualArousal: jest.fn(
        (sexualStateData) => sexualStateData.sex_excitation
      ),
      calculateSexualStates: jest.fn((moodData, arousal) => ({
        arousal,
        mood: moodData.valence,
      })),
      getTopSexualStates: jest.fn((sexualStates) => [
        {
          displayName: 'Arousal',
          label: String(sexualStates.arousal),
        },
      ]),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ moodSchema, sexualSchema, emotionOverrides })
    );
    controller.initialize();

    const moodDerived = document.getElementById('es-mood-derived');
    const sexualDerived = document.getElementById('es-sexual-derived');

    expect(
      moodDerived.querySelector('.emotional-state-panel__emotions-label')
        .textContent
    ).toBe('Current: ');
    expect(
      moodDerived.querySelector('.emotional-state-panel__emotion-item')
        .textContent
    ).toBe('Valence:0');
    expect(
      sexualDerived.querySelector('.sexual-state-panel__states-label')
        .textContent
    ).toBe('Current: ');
    expect(
      sexualDerived.querySelector('.sexual-state-panel__state-item').textContent
    ).toBe('Arousal:0');

    const sexualInput = document.getElementById(
      'es-input-core-sexual_state-sex_excitation-number'
    );
    sexualInput.value = '25';
    sexualInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(
      sexualDerived.querySelector('.sexual-state-panel__state-item').textContent
    ).toBe('Arousal:25');

    const moodInput = document.getElementById(
      'es-input-core-mood-valence-range'
    );
    moodInput.value = '-10';
    moodInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(
      moodDerived.querySelector('.emotional-state-panel__emotion-item')
        .textContent
    ).toBe('Valence:-10');
  });

  it('renders matches in priority order and selected expression after trigger', async () => {
    const eventBus = createEventBusStub();
    const expressionDispatcher = {
      dispatch: jest.fn(async (_actorId, _expression, _turn) => {
        await eventBus.dispatch('core:perceptible_event', {
          descriptionText: 'observer message',
          actorDescription: 'actor message',
          actorId: 'entity-0',
          targetId: null,
        });
        return true;
      }),
    };

    const perceptionEntryBuilder = {
      buildForRecipient: jest.fn(({ recipientId, baseEntry }) => ({
        descriptionText:
          recipientId === baseEntry.actorId
            ? baseEntry.actorDescription
            : baseEntry.descriptionText,
      })),
    };

    const expressionEvaluatorService = {
      evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
        matches: [
          { id: 'expr-high', priority: 10 },
          { id: 'expr-low', priority: 5 },
        ],
        evaluations: [],
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({
        expressionRegistryOverrides: {
          getAllExpressions: jest.fn().mockReturnValue([{ id: 'expr-high' }]),
        },
        expressionEvaluatorService,
        expressionDispatcher,
        eventBus,
        perceptionEntryBuilder,
      })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    const matchingItems = Array.from(
      document.querySelectorAll('#es-matching-list li')
    ).map((item) => item.textContent);

    expect(matchingItems).toEqual([
      'expr-high (priority 10)',
      'expr-low (priority 5)',
    ]);
    expect(
      document.getElementById('es-selected-expression').textContent
    ).toBe('expr-high (priority 10)');
    expect(document.getElementById('es-actor-message').textContent).toBe(
      'actor message'
    );
    expect(document.getElementById('es-observer-message').textContent).toBe(
      'observer message'
    );
  });

  it('keeps previous state zeroed without a recorded capture', async () => {
    const expressionContextBuilder = {
      buildContext: jest
        .fn()
        .mockReturnValueOnce({
          emotions: { calm: 0.4 },
          sexualStates: { aroused: 0.2 },
          moodAxes: { valence: 10 },
        })
        .mockReturnValueOnce({
          emotions: { calm: 0.2 },
          sexualStates: { aroused: 0.1 },
          moodAxes: { valence: 5 },
        }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({
        expressionContextBuilder,
        expressionEvaluatorService: {
          evaluateAllWithDiagnostics: jest
            .fn()
            .mockReturnValue({ matches: [], evaluations: [] }),
        },
      })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    triggerButton.click();
    await flushPromises();

    expect(expressionContextBuilder.buildContext).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      null
    );
    expect(expressionContextBuilder.buildContext).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      null
    );
  });

  it('renders empty recorded state sections on initialization', async () => {
    const controller = new ExpressionsSimulatorController(buildDependencies());

    controller.initialize();
    await flushPromises();

    expect(
      document.querySelector('.es-recorded-state-empty')?.textContent
    ).toBe('No recorded state captured yet.');
    const headings = Array.from(
      document.querySelectorAll('.es-recorded-state-section h4')
    ).map((node) => node.textContent);
    expect(headings).toEqual(['Mood Axes', 'Emotions', 'Sexual States']);
  });

  it('records current state and reuses it for subsequent evaluations', async () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 10,
        },
      },
    };
    const sexualSchema = {
      properties: {
        sex_excitation: {
          minimum: 0,
          maximum: 100,
          default: 25,
        },
      },
    };
    const emotionOverrides = {
      calculateEmotions: jest.fn(() => ({ calm: 0.5 })),
      calculateSexualArousal: jest.fn(() => 0.6),
      calculateSexualStates: jest.fn(() => ({ arousal: 0.6 })),
    };
    const expressionContextBuilder = {
      buildContext: jest.fn().mockReturnValue({
        emotions: {},
        sexualStates: {},
        moodAxes: {},
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({
        moodSchema,
        sexualSchema,
        emotionOverrides,
        expressionContextBuilder,
        expressionEvaluatorService: {
          evaluateAllWithDiagnostics: jest
            .fn()
            .mockReturnValue({ matches: [], evaluations: [] }),
        },
      })
    );

    controller.initialize();
    await flushPromises();

    document.getElementById('es-record-button').click();
    document.getElementById('es-trigger-button').click();
    await flushPromises();

    document.getElementById('es-trigger-button').click();
    await flushPromises();

    expect(expressionContextBuilder.buildContext).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      {
        moodAxes: { valence: 10 },
        emotions: { calm: 0.5 },
        sexualStates: { arousal: 0.6 },
      }
    );
    expect(expressionContextBuilder.buildContext).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      {
        moodAxes: { valence: 10 },
        emotions: { calm: 0.5 },
        sexualStates: { arousal: 0.6 },
      }
    );
  });

  it('records map-based state values for subsequent evaluation triggers', async () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 10,
        },
      },
    };
    const sexualSchema = {
      properties: {
        sex_excitation: {
          minimum: 0,
          maximum: 100,
          default: 25,
        },
      },
    };
    const emotionOverrides = {
      calculateEmotions: jest.fn(
        () => new Map([['calm', 0.5], ['joy', 0.2]])
      ),
      calculateSexualArousal: jest.fn(() => 0.1),
      calculateSexualStates: jest.fn(() => new Map([['arousal', 0.1]])),
    };
    const expressionContextBuilder = {
      buildContext: jest.fn((_actorId, _mood, _sexual, previousState) => {
        expect(previousState).toEqual({
          moodAxes: { valence: 10 },
          emotions: { calm: 0.5, joy: 0.2 },
          sexualStates: { arousal: 0.1 },
        });
        return { emotions: {}, sexualStates: {}, moodAxes: {} };
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({
        moodSchema,
        sexualSchema,
        emotionOverrides,
        expressionContextBuilder,
        expressionEvaluatorService: {
          evaluateAllWithDiagnostics: jest
            .fn()
            .mockReturnValue({ matches: [], evaluations: [] }),
        },
      })
    );

    controller.initialize();
    await flushPromises();

    document.getElementById('es-record-button').click();
    document.getElementById('es-trigger-button').click();
    await flushPromises();

    expect(expressionContextBuilder.buildContext).toHaveBeenCalledTimes(1);
  });

  it('renders recorded state values with formatting after capture', async () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 8,
        },
      },
    };
    const sexualSchema = {
      properties: {
        sex_excitation: {
          minimum: 0,
          maximum: 100,
          default: 20,
        },
      },
    };
    const emotionOverrides = {
      calculateEmotions: jest.fn(() => ({ calm: 0.3333 })),
      calculateSexualArousal: jest.fn(() => 0.1234),
      calculateSexualStates: jest.fn(() => ({ arousal: 0.1234 })),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ moodSchema, sexualSchema, emotionOverrides })
    );

    controller.initialize();
    await flushPromises();

    document.getElementById('es-record-button').click();

    const recordedItems = Array.from(
      document.querySelectorAll('.es-recorded-state-item')
    ).map((node) => node.textContent);

    expect(recordedItems).toEqual(
      expect.arrayContaining([
        'Valence: 8',
        'Calm: 0.333',
        'Arousal: 0.123',
      ])
    );
  });

  it('leaves recorded display unchanged if the calculator throws', async () => {
    const moodSchema = {
      properties: {
        valence: {
          minimum: -100,
          maximum: 100,
          default: 10,
        },
      },
    };
    const sexualSchema = {
      properties: {
        sex_excitation: {
          minimum: 0,
          maximum: 100,
          default: 25,
        },
      },
    };
    const emotionOverrides = {
      calculateEmotions: jest
        .fn()
        .mockReturnValueOnce({})
        .mockImplementationOnce(() => {
          throw new Error('boom');
        }),
    };

    const dependencies = buildDependencies({
      moodSchema,
      sexualSchema,
      emotionOverrides,
    });
    const controller = new ExpressionsSimulatorController(dependencies);

    controller.initialize();
    await flushPromises();

    document.getElementById('es-record-button').click();

    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      '[ExpressionsSimulator] Failed to record previous state.',
      expect.any(Error)
    );
    expect(
      document.querySelector('.es-recorded-state-empty')
    ).not.toBeNull();
  });

  it('clears selection and messages when no matches exist', async () => {
    const controller = new ExpressionsSimulatorController(
      buildDependencies({
        expressionEvaluatorService: {
          evaluateAllWithDiagnostics: jest
            .fn()
            .mockReturnValue({ matches: [], evaluations: [] }),
        },
      })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    expect(
      document.getElementById('es-selected-expression').textContent
    ).toBe('None');
    expect(document.getElementById('es-actor-message').textContent).toBe(
      'None'
    );
    expect(document.getElementById('es-observer-message').textContent).toBe(
      'None'
    );
  });

  it('updates evaluation count when evaluations render', async () => {
    const expressionEvaluatorService = {
      evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
        matches: [],
        evaluations: [
          {
            expression: { id: 'expr-one', priority: 2 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-two', priority: 1 },
            passed: false,
            prerequisites: [],
          },
        ],
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ expressionEvaluatorService })
    );

    controller.initialize();
    await flushPromises();

    expect(document.getElementById('es-evaluation-count').textContent).toBe(
      'Evaluated: --'
    );

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    expect(document.getElementById('es-evaluation-count').textContent).toBe(
      'Evaluated: 2'
    );
  });

  it('keeps evaluation count reset when evaluations are empty', async () => {
    const expressionEvaluatorService = {
      evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
        matches: [],
        evaluations: [],
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ expressionEvaluatorService })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    expect(document.getElementById('es-evaluation-count').textContent).toBe(
      'Evaluated: --'
    );
    expect(document.querySelector('.es-placeholder-message')).not.toBeNull();
  });

  it('renders evaluation log in priority order with badges', async () => {
    const expressionEvaluatorService = {
      evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
        matches: [],
        evaluations: [
          {
            expression: { id: 'expr-mid', priority: 5 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-zero' },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-high', priority: 10 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-low', priority: 1 },
            passed: true,
            prerequisites: [],
          },
        ],
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ expressionEvaluatorService })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    const evaluationNames = Array.from(
      document.querySelectorAll('.es-evaluation-name')
    ).map((node) => node.textContent);

    expect(evaluationNames).toEqual([
      'expr-high',
      'expr-mid',
      'expr-low',
      'expr-zero',
    ]);

    const badges = Array.from(
      document.querySelectorAll('.es-evaluation-priority')
    ).map((node) => node.textContent);

    expect(badges).toEqual(['P10', 'P5', 'P1', 'P0']);
  });

  it('orders evaluation log entries by priority then id', async () => {
    const expressionEvaluatorService = {
      evaluateAllWithDiagnostics: jest.fn().mockReturnValue({
        matches: [],
        evaluations: [
          {
            expression: { id: 'expr-c', priority: 5 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-a', priority: 5 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-z', priority: 10 },
            passed: true,
            prerequisites: [],
          },
          {
            expression: { id: 'expr-b', priority: 5 },
            passed: true,
            prerequisites: [],
          },
        ],
      }),
    };

    const controller = new ExpressionsSimulatorController(
      buildDependencies({ expressionEvaluatorService })
    );

    controller.initialize();
    await flushPromises();

    const triggerButton = document.getElementById('es-trigger-button');
    triggerButton.click();
    await flushPromises();

    const evaluationNames = Array.from(
      document.querySelectorAll('.es-evaluation-name')
    ).map((node) => node.textContent);

    expect(evaluationNames).toEqual([
      'expr-z',
      'expr-a',
      'expr-b',
      'expr-c',
    ]);
  });
});
