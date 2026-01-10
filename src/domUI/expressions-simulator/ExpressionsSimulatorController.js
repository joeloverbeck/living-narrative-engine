/**
 * @file ExpressionsSimulatorController - Scaffold controller for the expressions simulator.
 */

import { validateDependencies } from '../../utils/dependencyUtils.js';
import EntityDefinition from '../../entities/entityDefinition.js';

class ExpressionsSimulatorController {
  #logger;
  #dataRegistry;
  #entityManager;
  #emotionCalculatorService;
  #expressionRegistry;
  #expressionContextBuilder;
  #expressionEvaluatorService;
  #expressionDispatcher;
  #eventBus;
  #perceptionEntryBuilder;
  #containerElement = null;
  #elements = null;
  #state = null;
  #unsubscribePerceptibleEventListener = null;

  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {import('../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {object} dependencies.emotionCalculatorService
   * @param {object} dependencies.expressionRegistry
   * @param {object} dependencies.expressionContextBuilder
   * @param {object} dependencies.expressionEvaluatorService
   * @param {object} dependencies.expressionDispatcher
   * @param {import('../../interfaces/IEventBus.js').IEventBus} dependencies.eventBus
   * @param {object} dependencies.perceptionEntryBuilder
   */
  constructor({
    logger,
    dataRegistry,
    entityManager,
    emotionCalculatorService,
    expressionRegistry,
    expressionContextBuilder,
    expressionEvaluatorService,
    expressionDispatcher,
    eventBus,
    perceptionEntryBuilder,
  }) {
    validateDependencies(
      [
        { dependency: logger, name: 'ILogger', methods: ['info', 'warn'] },
        { dependency: dataRegistry, name: 'IDataRegistry', methods: ['get'] },
        { dependency: entityManager, name: 'IEntityManager' },
        {
          dependency: emotionCalculatorService,
          name: 'IEmotionCalculatorService',
          methods: [
            'calculateEmotions',
            'formatEmotionsForPrompt',
            'getTopEmotions',
            'calculateSexualArousal',
            'calculateSexualStates',
            'formatSexualStatesForPrompt',
            'getTopSexualStates',
          ],
        },
        { dependency: expressionRegistry, name: 'IExpressionRegistry' },
        {
          dependency: expressionContextBuilder,
          name: 'IExpressionContextBuilder',
        },
        {
          dependency: expressionEvaluatorService,
          name: 'IExpressionEvaluatorService',
        },
        { dependency: expressionDispatcher, name: 'IExpressionDispatcher' },
        {
          dependency: eventBus,
          name: 'IEventBus',
          methods: ['dispatch', 'subscribe'],
        },
        {
          dependency: perceptionEntryBuilder,
          name: 'IPerceptionEntryBuilder',
          methods: ['buildForRecipient'],
        },
      ],
      logger
    );

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#expressionRegistry = expressionRegistry;
    this.#expressionContextBuilder = expressionContextBuilder;
    this.#expressionEvaluatorService = expressionEvaluatorService;
    this.#expressionDispatcher = expressionDispatcher;
    this.#eventBus = eventBus;
    this.#perceptionEntryBuilder = perceptionEntryBuilder;
  }

  /**
   * Initialize the controller scaffold.
   */
  initialize() {
    this.#bindDom();
    this.#initializeState();
    this.#renderInputs();
    this.#updateDerivedOutputs();
    this.#initializeResults();
    this.#registerPerceptibleEventListener();
    this.#initializeSimulatorEntities();
    this.#logger.debug('[ExpressionsSimulator] Services ready.', {
      dataRegistry: !!this.#dataRegistry,
      entityManager: !!this.#entityManager,
      emotionCalculatorService: !!this.#emotionCalculatorService,
      expressionRegistry: !!this.#expressionRegistry,
      expressionContextBuilder: !!this.#expressionContextBuilder,
      expressionEvaluatorService: !!this.#expressionEvaluatorService,
      expressionDispatcher: !!this.#expressionDispatcher,
      eventBus: !!this.#eventBus,
      perceptionEntryBuilder: !!this.#perceptionEntryBuilder,
    });
    this.#logger.info('[ExpressionsSimulator] Controller scaffold ready.');
  }

  /**
   * Bind top-level DOM container for future UI updates.
   *
   * @private
   */
  #bindDom() {
    this.#containerElement = document.getElementById(
      'expressions-simulator-container'
    );

    if (!this.#containerElement) {
      this.#logger.warn(
        '[ExpressionsSimulator] Container element not found (#expressions-simulator-container).'
      );
      return;
    }

    this.#elements = {
      moodInputs: this.#containerElement.querySelector('#es-mood-inputs'),
      sexualInputs: this.#containerElement.querySelector('#es-sexual-inputs'),
      traitsInputs: this.#containerElement.querySelector('#es-traits-inputs'),
      moodDerived: this.#containerElement.querySelector('#es-mood-derived'),
      sexualDerived: this.#containerElement.querySelector('#es-sexual-derived'),
      recordButton: this.#containerElement.querySelector('#es-record-button'),
      recordedStateDisplay: this.#containerElement.querySelector(
        '#es-recorded-state-display'
      ),
      expressionTotal: this.#containerElement.querySelector(
        '#es-expression-total'
      ),
      triggerButton: this.#containerElement.querySelector('#es-trigger-button'),
      matchingList: this.#containerElement.querySelector('#es-matching-list'),
      actorMessage: this.#containerElement.querySelector('#es-actor-message'),
      observerMessage: this.#containerElement.querySelector(
        '#es-observer-message'
      ),
      evaluationLog: this.#containerElement.querySelector('#es-evaluation-log'),
      evaluationCount: this.#containerElement.querySelector(
        '#es-evaluation-count'
      ),
    };

    if (!this.#elements.moodInputs) {
      this.#logger.warn(
        '[ExpressionsSimulator] Mood inputs container missing (#es-mood-inputs).'
      );
    }
    if (!this.#elements.sexualInputs) {
      this.#logger.warn(
        '[ExpressionsSimulator] Sexual inputs container missing (#es-sexual-inputs).'
      );
    }
    if (!this.#elements.traitsInputs) {
      this.#logger.warn(
        '[ExpressionsSimulator] Affect traits inputs container missing (#es-traits-inputs).'
      );
    }
    if (!this.#elements.moodDerived) {
      this.#logger.warn(
        '[ExpressionsSimulator] Mood derived output missing (#es-mood-derived).'
      );
    }
    if (!this.#elements.sexualDerived) {
      this.#logger.warn(
        '[ExpressionsSimulator] Sexual derived output missing (#es-sexual-derived).'
      );
    }
    if (!this.#elements.recordButton) {
      this.#logger.warn(
        '[ExpressionsSimulator] Record button missing (#es-record-button).'
      );
    }
    if (!this.#elements.recordedStateDisplay) {
      this.#logger.warn(
        '[ExpressionsSimulator] Recorded state display missing (#es-recorded-state-display).'
      );
    }
    if (!this.#elements.expressionTotal) {
      this.#logger.warn(
        '[ExpressionsSimulator] Registry summary total missing (#es-expression-total).'
      );
    }
    if (!this.#elements.triggerButton) {
      this.#logger.warn(
        '[ExpressionsSimulator] Trigger button missing (#es-trigger-button).'
      );
    }
    if (!this.#elements.matchingList) {
      this.#logger.warn(
        '[ExpressionsSimulator] Matching list missing (#es-matching-list).'
      );
    }
    if (!this.#elements.actorMessage) {
      this.#logger.warn(
        '[ExpressionsSimulator] Actor message output missing (#es-actor-message).'
      );
    }
    if (!this.#elements.observerMessage) {
      this.#logger.warn(
        '[ExpressionsSimulator] Observer message output missing (#es-observer-message).'
      );
    }
    if (!this.#elements.evaluationLog) {
      this.#logger.warn(
        '[ExpressionsSimulator] Evaluation log output missing (#es-evaluation-log).'
      );
    }
    if (!this.#elements.evaluationCount) {
      this.#logger.warn(
        '[ExpressionsSimulator] Evaluation count output missing (#es-evaluation-count).'
      );
    }
  }

  /**
   * Initialize placeholder state for future simulator behavior.
   *
   * @private
   */
  #initializeState() {
    const moodSchema = this.#getComponentSchema('core:mood');
    const sexualSchema = this.#getComponentSchema('core:sexual_state');
    const traitsSchema = this.#getComponentSchema('core:affect_traits');

    this.#state = {
      currentMood: this.#buildDefaultState(moodSchema),
      currentSexualState: this.#buildDefaultState(sexualSchema),
      currentAffectTraits: this.#buildDefaultState(traitsSchema),
      recordedPreviousState: null,
      actorId: null,
      observerId: null,
      entityInitPromise: null,
      lastPerceptibleEvent: null,
      turnNumber: 0,
    };
  }

  /**
   * Render component inputs and derived outputs.
   *
   * @private
   */
  #renderInputs() {
    if (!this.#containerElement) {
      return;
    }

    this.#renderComponentInputs({
      componentId: 'core:mood',
      targetElement: this.#elements?.moodInputs,
      stateKey: 'currentMood',
    });
    this.#renderComponentInputs({
      componentId: 'core:sexual_state',
      targetElement: this.#elements?.sexualInputs,
      stateKey: 'currentSexualState',
    });
    this.#renderComponentInputs({
      componentId: 'core:affect_traits',
      targetElement: this.#elements?.traitsInputs,
      stateKey: 'currentAffectTraits',
    });
  }

  /**
   * Render inputs for a given component definition.
   *
   * @param {object} params
   * @param {string} params.componentId
   * @param {HTMLElement|null} params.targetElement
   * @param {'currentMood'|'currentSexualState'} params.stateKey
   * @private
   */
  #renderComponentInputs({ componentId, targetElement, stateKey }) {
    if (!targetElement) {
      return;
    }

    targetElement.innerHTML = '';
    const schema = this.#getComponentSchema(componentId);

    if (!schema || !schema.properties) {
      const placeholder = document.createElement('p');
      placeholder.className = 'es-placeholder-message';
      placeholder.textContent = 'Inputs unavailable.';
      targetElement.appendChild(placeholder);
      return;
    }

    const stateValues = this.#state?.[stateKey] || {};

    for (const [propertyKey, propertySchema] of Object.entries(
      schema.properties
    )) {
      const row = this.#createInputRow({
        componentId,
        propertyKey,
        propertySchema,
        value: stateValues[propertyKey],
        onChange: (nextValue) => {
          if (!this.#state?.[stateKey]) {
            return;
          }
          this.#state[stateKey][propertyKey] = nextValue;
          this.#updateDerivedOutputs();
        },
      });

      targetElement.appendChild(row);
    }
  }

  /**
   * Build a single input row.
   *
   * @param {object} params
   * @param {string} params.componentId
   * @param {string} params.propertyKey
   * @param {object} params.propertySchema
   * @param {number} params.value
   * @param {(value: number) => void} params.onChange
   * @returns {HTMLElement}
   * @private
   */
  #createInputRow({
    componentId,
    propertyKey,
    propertySchema,
    value,
    onChange,
  }) {
    const min = typeof propertySchema.minimum === 'number' ? propertySchema.minimum : 0;
    const max = typeof propertySchema.maximum === 'number' ? propertySchema.maximum : 100;
    const defaultValue =
      typeof propertySchema.default === 'number' ? propertySchema.default : 0;
    const initialValue = this.#coerceValue(value, min, max, defaultValue);

    const row = document.createElement('div');
    row.className = 'es-input-row';
    row.dataset.component = componentId;
    row.dataset.property = propertyKey;

    const label = document.createElement('label');
    label.className = 'es-input-label';
    label.textContent = this.#formatPropertyLabel(propertyKey);
    row.appendChild(label);

    if (propertySchema.description) {
      const description = document.createElement('p');
      description.className = 'es-input-description';
      description.textContent = propertySchema.description;
      row.appendChild(description);
    }

    const controlGroup = document.createElement('div');
    controlGroup.className = 'es-input-controls';

    const rangeId = this.#buildInputId(componentId, propertyKey, 'range');
    const numberId = this.#buildInputId(componentId, propertyKey, 'number');

    const rangeLabel = document.createElement('label');
    rangeLabel.className = 'es-input-sub-label';
    rangeLabel.textContent = 'Slider';
    rangeLabel.htmlFor = rangeId;

    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    rangeInput.id = rangeId;
    rangeInput.min = String(min);
    rangeInput.max = String(max);
    rangeInput.step = '1';
    rangeInput.value = String(initialValue);

    const numberLabel = document.createElement('label');
    numberLabel.className = 'es-input-sub-label';
    numberLabel.textContent = 'Value';
    numberLabel.htmlFor = numberId;

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.id = numberId;
    numberInput.min = String(min);
    numberInput.max = String(max);
    numberInput.step = '1';
    numberInput.value = String(initialValue);

    const readout = document.createElement('span');
    readout.className = 'es-input-readout';
    readout.textContent = String(initialValue);

    const applyValue = (rawValue) => {
      const nextValue = this.#coerceValue(rawValue, min, max, defaultValue);
      rangeInput.value = String(nextValue);
      numberInput.value = String(nextValue);
      readout.textContent = String(nextValue);
      onChange(nextValue);
    };

    rangeInput.addEventListener('input', (event) => {
      applyValue(event.target.value);
    });

    numberInput.addEventListener('input', (event) => {
      applyValue(event.target.value);
    });

    const rangeBlock = document.createElement('div');
    rangeBlock.className = 'es-input-control';
    rangeBlock.appendChild(rangeLabel);
    rangeBlock.appendChild(rangeInput);

    const numberBlock = document.createElement('div');
    numberBlock.className = 'es-input-control';
    numberBlock.appendChild(numberLabel);
    numberBlock.appendChild(numberInput);

    controlGroup.appendChild(rangeBlock);
    controlGroup.appendChild(numberBlock);
    controlGroup.appendChild(readout);

    row.appendChild(controlGroup);

    return row;
  }

  /**
   * Update derived emotion and sexual state text.
   *
   * @private
   */
  #updateDerivedOutputs() {
    const moodData = this.#state?.currentMood || {};
    const sexualStateData = this.#state?.currentSexualState || {};
    const affectTraitsData = this.#state?.currentAffectTraits || {};

    const emotions = this.#emotionCalculatorService.calculateEmotions(
      moodData,
      null,
      sexualStateData,
      affectTraitsData
    );
    const emotionItems = this.#emotionCalculatorService.getTopEmotions(emotions);

    const arousal =
      this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);
    const sexualStates = this.#emotionCalculatorService.calculateSexualStates(
      moodData,
      arousal,
      sexualStateData
    );
    const sexualStateItems =
      this.#emotionCalculatorService.getTopSexualStates(sexualStates);

    this.#renderDerivedStateList({
      container: this.#elements?.moodDerived,
      items: emotionItems,
      wrapperClass: 'emotional-state-panel__emotions',
      labelClass: 'emotional-state-panel__emotions-label',
      listClass: 'emotional-state-panel__emotions-list',
      itemClass: 'emotional-state-panel__emotion-item',
      nameClass: 'emotional-state-panel__emotion-name',
      valueClass: 'emotional-state-panel__emotion-label',
    });
    this.#renderDerivedStateList({
      container: this.#elements?.sexualDerived,
      items: sexualStateItems,
      wrapperClass: 'sexual-state-panel__states',
      labelClass: 'sexual-state-panel__states-label',
      listClass: 'sexual-state-panel__states-list',
      itemClass: 'sexual-state-panel__state-item',
      nameClass: 'sexual-state-panel__state-name',
      valueClass: 'sexual-state-panel__state-label',
    });
  }

  /**
   * @param {object} params
   * @param {HTMLElement|null} params.container
   * @param {Array<{displayName: string, label: string}>} params.items
   * @param {string} params.wrapperClass
   * @param {string} params.labelClass
   * @param {string} params.listClass
   * @param {string} params.itemClass
   * @param {string} params.nameClass
   * @param {string} params.valueClass
   * @private
   */
  #renderDerivedStateList({
    container,
    items,
    wrapperClass,
    labelClass,
    listClass,
    itemClass,
    nameClass,
    valueClass,
  }) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = wrapperClass;

    if (!items || items.length === 0) {
      wrapper.textContent = 'Current: neutral';
      container.appendChild(wrapper);
      return;
    }

    const label = document.createElement('span');
    label.className = labelClass;
    label.textContent = 'Current: ';
    wrapper.appendChild(label);

    const list = document.createElement('div');
    list.className = listClass;
    wrapper.appendChild(list);

    items.forEach((item) => {
      const itemElement = document.createElement('span');
      itemElement.className = itemClass;

      const nameElement = document.createElement('span');
      nameElement.className = nameClass;
      nameElement.textContent = `${item.displayName}:`;

      const valueElement = document.createElement('span');
      valueElement.className = valueClass;
      valueElement.textContent = item.label;

      itemElement.appendChild(nameElement);
      itemElement.appendChild(valueElement);
      list.appendChild(itemElement);
    });

    container.appendChild(wrapper);
  }

  /**
   * @param {string} componentId
   * @returns {object|null}
   * @private
   */
  #getComponentSchema(componentId) {
    const component = this.#dataRegistry.get('components', componentId);
    if (!component || !component.dataSchema) {
      this.#logger.warn(
        `[ExpressionsSimulator] Component schema missing for ${componentId}.`
      );
      return null;
    }
    return component.dataSchema;
  }

  /**
   * @param {object|null} schema
   * @returns {Record<string, number>}
   * @private
   */
  #buildDefaultState(schema) {
    if (!schema || !schema.properties) {
      return {};
    }

    const defaults = {};
    for (const [key, definition] of Object.entries(schema.properties)) {
      defaults[key] =
        typeof definition.default === 'number' ? definition.default : 0;
    }
    return defaults;
  }

  /**
   * @param {string} componentId
   * @param {string} propertyKey
   * @param {string} suffix
   * @returns {string}
   * @private
   */
  #buildInputId(componentId, propertyKey, suffix) {
    const cleanComponent = componentId.replace(/[^a-z0-9_-]/gi, '-');
    const cleanProperty = propertyKey.replace(/[^a-z0-9_-]/gi, '-');
    return `es-input-${cleanComponent}-${cleanProperty}-${suffix}`;
  }

  /**
   * @param {string} propertyKey
   * @returns {string}
   * @private
   */
  #formatPropertyLabel(propertyKey) {
    return propertyKey
      .split('_')
      .map((segment) =>
        segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment
      )
      .join(' ');
  }

  /**
   * @param {string|number} rawValue
   * @param {number} min
   * @param {number} max
   * @param {number} fallback
   * @returns {number}
   * @private
   */
  #coerceValue(rawValue, min, max, fallback) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  /**
   * Initialize the results panel outputs.
   *
   * @private
   */
  #initializeResults() {
    this.#renderExpressionTotal();
    this.#renderMatches([]);
    this.#renderEvaluationLog(null);
    this.#renderRecordedState(this.#state?.recordedPreviousState ?? null);
    this.#clearMessages();

    if (this.#elements?.triggerButton) {
      this.#elements.triggerButton.disabled = true;
      this.#elements.triggerButton.addEventListener('click', () => {
        void this.#handleTriggerExpression();
      });
    }

    if (this.#elements?.recordButton) {
      this.#elements.recordButton.disabled = true;
      this.#elements.recordButton.addEventListener('click', () => {
        this.#handleRecordState();
      });
    }
  }

  /**
   * Subscribe to perceptible event dispatches for local message building.
   *
   * @private
   */
  #registerPerceptibleEventListener() {
    if (!this.#eventBus) {
      return;
    }

    const handler = (event) => {
      this.#state.lastPerceptibleEvent = event?.payload ?? null;
    };

    const unsubscribe = this.#eventBus.subscribe(
      'core:perceptible_event',
      handler
    );
    if (typeof unsubscribe === 'function') {
      this.#unsubscribePerceptibleEventListener = unsubscribe;
    }
  }

  /**
   * Ensure simulator-owned entities exist.
   *
   * @private
   */
  #initializeSimulatorEntities() {
    this.#state.entityInitPromise = this.#ensureSimulatorEntities()
      .then(() => {
        if (this.#elements?.triggerButton) {
          this.#elements.triggerButton.disabled = false;
        }
        if (this.#elements?.recordButton) {
          this.#elements.recordButton.disabled = false;
        }
      })
      .catch((error) => {
        this.#logger.warn(
          '[ExpressionsSimulator] Failed to initialize simulator entities.',
          error
        );
      });
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async #ensureSimulatorEntities() {
    const definitionId = 'core:expression_simulator_entity';
    const locationId = 'sim:expression_lab';
    const locationDefinitionId = locationId;

    const existingDefinition = this.#dataRegistry.get(
      'entityDefinitions',
      definitionId
    );
    const hasValidDefinition =
      existingDefinition &&
      typeof existingDefinition.hasComponent === 'function';

    if (!hasValidDefinition && typeof this.#dataRegistry.store === 'function') {
      const runtimeDefinition = new EntityDefinition(definitionId, {
        description:
          'Runtime-only entity definition for the expressions simulator.',
        components: {
          'core:name': {
            text: 'Expression Simulator Entity',
          },
          'core:actor': {},
          'core:perception_log': {
            maxEntries: 20,
            logEntries: [],
          },
        },
      });

      this.#dataRegistry.store(
        'entityDefinitions',
        definitionId,
        runtimeDefinition
      );
    }

    const existingLocationDefinition = this.#dataRegistry.get(
      'entityDefinitions',
      locationDefinitionId
    );
    const hasValidLocationDefinition =
      existingLocationDefinition &&
      typeof existingLocationDefinition.hasComponent === 'function';

    if (
      !hasValidLocationDefinition &&
      typeof this.#dataRegistry.store === 'function'
    ) {
      const runtimeLocationDefinition = new EntityDefinition(
        locationDefinitionId,
        {
          description:
            'Runtime-only location definition for expressions simulator events.',
          components: {
            'core:name': {
              text: 'Expressions Lab',
            },
            'locations:sensorial_links': {
              targets: [],
            },
          },
        }
      );

      this.#dataRegistry.store(
        'entityDefinitions',
        locationDefinitionId,
        runtimeLocationDefinition
      );
    }

    const hasLocationEntity =
      (typeof this.#entityManager.hasEntity === 'function' &&
        this.#entityManager.hasEntity(locationId)) ||
      (typeof this.#entityManager.getEntityInstance === 'function' &&
        this.#entityManager.getEntityInstance(locationId));

    if (!hasLocationEntity) {
      await this.#entityManager.createEntityInstance(locationDefinitionId, {
        instanceId: locationId,
      });
    }

    const actorEntity = await this.#entityManager.createEntityInstance(
      definitionId,
      {
        componentOverrides: {
          'core:name': { text: 'Expression Simulator Actor' },
          'core:position': { locationId },
        },
      }
    );

    const observerEntity = await this.#entityManager.createEntityInstance(
      definitionId,
      {
        componentOverrides: {
          'core:name': { text: 'Expression Simulator Observer' },
          'core:position': { locationId },
        },
      }
    );

    this.#state.actorId = actorEntity?.id ?? actorEntity ?? null;
    this.#state.observerId = observerEntity?.id ?? observerEntity ?? null;
  }

  /**
   * Handle expression evaluation trigger.
   *
   * @private
   */
  async #handleTriggerExpression() {
    if (!this.#state) {
      return;
    }

    this.#renderEvaluationLog(null);

    if (this.#state.entityInitPromise) {
      await this.#state.entityInitPromise;
    }

    const { actorId, observerId } = this.#state;
    if (!actorId || !observerId) {
      this.#logger.warn(
        '[ExpressionsSimulator] Missing simulator entities; cannot evaluate expressions.'
      );
      return;
    }

    const moodData = this.#state.currentMood || {};
    const sexualStateData = this.#state.currentSexualState || {};

    await this.#syncActorComponents(actorId, moodData, sexualStateData);

    const context = this.#expressionContextBuilder.buildContext(
      actorId,
      moodData,
      sexualStateData,
      this.#state.recordedPreviousState ?? null
    );
    const { matches, evaluations } =
      this.#expressionEvaluatorService.evaluateAllWithDiagnostics(context);

    this.#renderMatches(matches);
    this.#renderEvaluationLog(evaluations);
    const selectedExpression = matches[0] ?? null;

    if (!selectedExpression) {
      this.#clearMessages();
      return;
    }

    this.#state.lastPerceptibleEvent = null;
    const turnNumber = this.#nextTurnNumber();
    const dispatched = await this.#expressionDispatcher.dispatch(
      actorId,
      selectedExpression,
      turnNumber
    );

    if (!dispatched) {
      this.#clearMessages();
      return;
    }

    const eventPayload = this.#state.lastPerceptibleEvent;
    if (!eventPayload) {
      this.#clearMessages();
      return;
    }

    this.#renderMessages(eventPayload, actorId, observerId);
  }

  /**
   * @param {string} actorId
   * @param {object} moodData
   * @param {object} sexualStateData
   * @returns {Promise<void>}
   * @private
   */
  async #syncActorComponents(actorId, moodData, sexualStateData) {
    if (!this.#entityManager || !actorId) {
      return;
    }

    if (typeof this.#entityManager.addComponent === 'function') {
      await this.#entityManager.addComponent(actorId, 'core:mood', {
        ...moodData,
      });
      await this.#entityManager.addComponent(actorId, 'core:sexual_state', {
        ...sexualStateData,
      });
    }
  }

  /**
   * @private
   */
  #renderExpressionTotal() {
    if (!this.#elements?.expressionTotal) {
      return;
    }

    const total =
      this.#expressionRegistry?.getAllExpressions()?.length ?? 0;
    this.#elements.expressionTotal.textContent = String(total);
  }

  /**
   * @param {object[]} matches
   * @private
   */
  #renderMatches(matches) {
    if (!this.#elements?.matchingList) {
      return;
    }

    this.#elements.matchingList.innerHTML = '';

    if (!Array.isArray(matches) || matches.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = 'No matching expressions.';
      this.#elements.matchingList.appendChild(emptyItem);
      return;
    }

    for (const expression of matches) {
      const item = document.createElement('li');
      const priority =
        typeof expression?.priority === 'number'
          ? ` (priority ${expression.priority})`
          : '';
      item.textContent = `${expression?.id ?? 'unknown'}${priority}`;
      this.#elements.matchingList.appendChild(item);
    }
  }

  /**
   * @param {Array<{expression: object, passed: boolean, prerequisites: Array<{index: number, status: string, message: string}>}>|null} evaluations
   * @private
   */
  #renderEvaluationLog(evaluations) {
    if (!this.#elements?.evaluationLog) {
      return;
    }

    this.#elements.evaluationLog.innerHTML = '';

    if (this.#elements?.evaluationCount) {
      this.#elements.evaluationCount.textContent = 'Evaluated: --';
    }

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'es-placeholder-message';
      placeholder.textContent =
        'Trigger expression to see evaluation diagnostics.';
      this.#elements.evaluationLog.appendChild(placeholder);
      return;
    }

    if (this.#elements?.evaluationCount) {
      this.#elements.evaluationCount.textContent = `Evaluated: ${evaluations.length}`;
    }

    const sortedEvaluations = [...evaluations].sort((a, b) => {
      const priorityA =
        typeof a?.expression?.priority === 'number' ? a.expression.priority : 0;
      const priorityB =
        typeof b?.expression?.priority === 'number' ? b.expression.priority : 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      const idA = a?.expression?.id ?? '';
      const idB = b?.expression?.id ?? '';
      return idA.localeCompare(idB);
    });

    for (const evaluation of sortedEvaluations) {
      const item = document.createElement('div');
      item.className = `es-evaluation-item ${
        evaluation.passed
          ? 'es-evaluation-item--pass'
          : 'es-evaluation-item--fail'
      }`;

      const priorityValue =
        typeof evaluation?.expression?.priority === 'number'
          ? evaluation.expression.priority
          : 0;
      const priority = document.createElement('span');
      priority.className = 'es-evaluation-priority';
      priority.textContent = `P${priorityValue}`;
      item.appendChild(priority);

      const content = document.createElement('div');
      content.className = 'es-evaluation-content';

      const header = document.createElement('div');
      header.className = 'es-evaluation-header';

      const name = document.createElement('span');
      name.className = 'es-evaluation-name';
      name.textContent = evaluation.expression?.id ?? 'unknown';

      const status = document.createElement('span');
      status.className = 'es-evaluation-status';
      status.textContent = evaluation.passed ? 'Passed' : 'Failed';

      header.appendChild(name);
      header.appendChild(status);
      content.appendChild(header);

      const details = document.createElement('div');
      details.className = 'es-evaluation-details';

      const skipped = evaluation.prerequisites.filter(
        (result) => result.status === 'skipped'
      );
      const failed = evaluation.prerequisites.filter(
        (result) => result.status === 'failed'
      );

      if (evaluation.passed) {
        if (evaluation.prerequisites.length === 0) {
          const note = document.createElement('p');
          note.textContent = 'No prerequisites; auto-passed.';
          details.appendChild(note);
        } else if (skipped.length > 0) {
          const note = document.createElement('p');
          note.textContent = `Passed with ${skipped.length} prerequisite${
            skipped.length === 1 ? '' : 's'
          } skipped due to missing logic.`;
          details.appendChild(note);
        }
      } else {
        failed.forEach((result) => {
          const note = document.createElement('p');
          note.textContent = `Prerequisite ${result.index + 1}: ${result.message}`;
          details.appendChild(note);
        });
        if (skipped.length > 0) {
          const note = document.createElement('p');
          note.textContent = `Skipped ${skipped.length} prerequisite${
            skipped.length === 1 ? '' : 's'
          } due to missing logic.`;
          details.appendChild(note);
        }
      }

      if (details.childNodes.length > 0) {
        content.appendChild(details);
      }

      item.appendChild(content);
      this.#elements.evaluationLog.appendChild(item);
    }
  }

  /**
   * @param {object} payload
   * @param {string} actorId
   * @param {string} observerId
   * @private
   */
  #renderMessages(payload, actorId, observerId) {
    if (!this.#elements?.actorMessage || !this.#elements?.observerMessage) {
      return;
    }

    const baseEntry = payload;
    const actorMessage = this.#perceptionEntryBuilder.buildForRecipient({
      recipientId: actorId,
      baseEntry,
      actorDescription: payload.actorDescription,
      targetDescription: payload.targetDescription,
      originatingActorId: payload.actorId,
      targetId: payload.targetId,
      filteredRecipientsMap: null,
    });

    const observerMessage = this.#perceptionEntryBuilder.buildForRecipient({
      recipientId: observerId,
      baseEntry,
      actorDescription: payload.actorDescription,
      targetDescription: payload.targetDescription,
      originatingActorId: payload.actorId,
      targetId: payload.targetId,
      filteredRecipientsMap: null,
    });

    this.#elements.actorMessage.textContent =
      actorMessage?.descriptionText ?? '';
    this.#elements.observerMessage.textContent =
      observerMessage?.descriptionText ?? '';
  }

  /**
   * @private
   */
  #clearMessages() {
    if (this.#elements?.actorMessage) {
      this.#elements.actorMessage.textContent = 'None';
    }
    if (this.#elements?.observerMessage) {
      this.#elements.observerMessage.textContent = 'None';
    }
  }

  /**
   * @returns {number}
   * @private
   */
  #nextTurnNumber() {
    this.#state.turnNumber += 1;
    return this.#state.turnNumber;
  }

  /**
   * Record the current mood/derived values as the next previous-state capture.
   *
   * @private
   */
  #handleRecordState() {
    if (!this.#state) {
      return;
    }

    const moodData = this.#state.currentMood || {};
    const sexualStateData = this.#state.currentSexualState || {};

    try {
      const emotions = this.#emotionCalculatorService.calculateEmotions(
        moodData,
        null,
        sexualStateData
      );

      const arousal =
        this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);
      const sexualStates =
        this.#emotionCalculatorService.calculateSexualStates(
          moodData,
          arousal,
          sexualStateData
        );

      const normalizedEmotions =
        emotions instanceof Map ? Object.fromEntries(emotions) : { ...emotions };
      const normalizedSexualStates =
        sexualStates instanceof Map
          ? Object.fromEntries(sexualStates)
          : { ...sexualStates };

      this.#state.recordedPreviousState = {
        moodAxes: { ...moodData },
        emotions: normalizedEmotions,
        sexualStates: normalizedSexualStates,
      };
      this.#renderRecordedState(this.#state.recordedPreviousState);
    } catch (error) {
      this.#logger.warn(
        '[ExpressionsSimulator] Failed to record previous state.',
        error
      );
    }
  }

  /**
   * @param {{moodAxes: object, emotions: object, sexualStates: object}|null} recordedState
   * @private
   */
  #renderRecordedState(recordedState) {
    if (!this.#elements?.recordedStateDisplay) {
      return;
    }

    this.#elements.recordedStateDisplay.innerHTML = '';

    if (!recordedState) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'es-placeholder-message es-recorded-state-empty';
      emptyMessage.textContent = 'No recorded state captured yet.';
      this.#elements.recordedStateDisplay.appendChild(emptyMessage);
    }

    this.#renderRecordedSection({
      title: 'Mood Axes',
      values: recordedState?.moodAxes,
      emptyText: 'No recorded mood axes.',
      formatter: this.#formatRecordedInteger,
    });

    this.#renderRecordedSection({
      title: 'Emotions',
      values: recordedState?.emotions,
      emptyText: 'No recorded emotions.',
      formatter: this.#formatRecordedFloat,
    });

    this.#renderRecordedSection({
      title: 'Sexual States',
      values: recordedState?.sexualStates,
      emptyText: 'No recorded sexual states.',
      formatter: this.#formatRecordedFloat,
    });
  }

  /**
   * @param {object} params
   * @param {string} params.title
   * @param {object|undefined} params.values
   * @param {string} params.emptyText
   * @param {(value: number) => string} params.formatter
   * @private
   */
  #renderRecordedSection({ title, values, emptyText, formatter }) {
    const section = document.createElement('div');
    section.className = 'es-recorded-state-section';

    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'es-recorded-state-list';

    const entries = values && typeof values === 'object'
      ? Object.entries(values)
      : [];

    if (entries.length === 0) {
      const item = document.createElement('li');
      item.className = 'es-recorded-state-item';
      item.textContent = emptyText;
      list.appendChild(item);
    } else {
      entries.forEach(([key, value]) => {
        const item = document.createElement('li');
        item.className = 'es-recorded-state-item';
        const label = this.#formatPropertyLabel(key);
        item.textContent = `${label}: ${formatter(value)}`;
        list.appendChild(item);
      });
    }

    section.appendChild(list);
    this.#elements.recordedStateDisplay.appendChild(section);
  }

  /**
   * @param {number} value
   * @returns {string}
   * @private
   */
  #formatRecordedInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0';
    }
    return String(Math.round(numeric));
  }

  /**
   * @param {number} value
   * @returns {string}
   * @private
   */
  #formatRecordedFloat(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0.000';
    }
    return numeric.toFixed(3);
  }

  /**
   * Cleanup placeholder. Future teardown hooks should be added here.
   */
  dispose() {
    if (typeof this.#unsubscribePerceptibleEventListener === 'function') {
      this.#unsubscribePerceptibleEventListener();
    }

    this.#containerElement = null;
    this.#elements = null;
    this.#state = null;
  }
}

export default ExpressionsSimulatorController;
