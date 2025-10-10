import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { readFileSync } from 'fs';

import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { InputStateController } from '../../../src/domUI/inputStateController.js';
import InputHandler from '../../../src/input/inputHandler.js';
import GlobalKeyHandler from '../../../src/input/globalKeyHandler.js';
const CORE_EVENTS_DIR = new URL(
  '../../../data/mods/core/events/',
  import.meta.url
);

/**
 * Lightweight schema validator used to satisfy the ValidatedEventDispatcher dependency
 * without mocking its behaviour. It mirrors the interface expected by the dispatcher
 * while always reporting successful validation so the focus remains on module interaction.
 */
class PassthroughSchemaValidator {
  constructor() {
    this.loadedSchemas = new Set();
  }

  addSchema(_schema, schemaId) {
    if (schemaId) {
      this.loadedSchemas.add(schemaId);
    }
    return Promise.resolve(true);
  }

  addSchemas(schemas) {
    schemas?.forEach((schema) => {
      if (schema?.id || schema?.$id) {
        this.loadedSchemas.add(schema.id ?? schema.$id);
      }
    });
    return Promise.resolve(true);
  }

  removeSchema(schemaId) {
    if (schemaId) {
      this.loadedSchemas.delete(schemaId);
    }
    return true;
  }

  isSchemaLoaded(schemaId) {
    return true;
  }

  validate() {
    return { isValid: true, errors: [] };
  }

  getValidator() {
    return () => () => true;
  }
}

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function loadCoreEventDefinition(fileName) {
  const eventUrl = new URL(fileName, CORE_EVENTS_DIR);
  return JSON.parse(readFileSync(eventUrl, 'utf8'));
}

async function tick() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('Input handlers integration', () => {
  let logger;
  let registry;
  let gameDataRepository;
  let eventBus;
  let schemaValidator;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let documentContext;
  let inputElement;
  let formElement;
  let inputStateController;
  let inputHandler;
  let globalKeyHandler;
  let commandLog;
  const activeSubscriptions = [];

  beforeEach(() => {
    logger = createLogger();
    registry = new InMemoryDataRegistry({ logger });

    const enableInputDef = loadCoreEventDefinition('enable_input.event.json');
    const disableInputDef = loadCoreEventDefinition('disable_input.event.json');
    const gainedFocusDef = loadCoreEventDefinition(
      'speech_input_gained_focus.event.json'
    );
    const lostFocusDef = loadCoreEventDefinition(
      'speech_input_lost_focus.event.json'
    );

    registry.store('events', enableInputDef.id, enableInputDef);
    registry.store('events', disableInputDef.id, disableInputDef);
    registry.store('events', gainedFocusDef.id, gainedFocusDef);
    registry.store('events', lostFocusDef.id, lostFocusDef);
    registry.store('events', 'ui:toggle_inventory', {
      id: 'ui:toggle_inventory',
      payloadSchema: {
        type: 'object',
        additionalProperties: false,
      },
    });

    eventBus = new EventBus({ logger });
    schemaValidator = new PassthroughSchemaValidator();
    gameDataRepository = new GameDataRepository(registry, logger);
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    document.body.innerHTML = `
      <main id="app">
        <form id="command-form">
          <input id="command-input" />
        </form>
        <div id="outside"></div>
      </main>
    `;

    documentContext = new DocumentContext(document, logger);
    inputElement = document.getElementById('command-input');
    formElement = document.getElementById('command-form');

    inputStateController = new InputStateController({
      logger,
      documentContext,
      safeEventDispatcher,
      inputElement,
    });

    commandLog = [];
    inputHandler = new InputHandler(
      inputElement,
      (command) => {
        commandLog.push(command);
      },
      validatedEventDispatcher,
      {
        document,
        logger,
      }
    );

    globalKeyHandler = new GlobalKeyHandler(document, validatedEventDispatcher);
  });

  afterEach(() => {
    activeSubscriptions.splice(0).forEach((unsub) => {
      try {
        unsub?.();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to unsubscribe during cleanup', error);
      }
    });

    globalKeyHandler?.dispose();
    inputHandler?.dispose();
    inputStateController?.dispose();

    document.body.innerHTML = '';
  });

  async function dispatchThroughSafe(eventName, payload) {
    await safeEventDispatcher.dispatch(eventName, payload);
    await tick();
  }

  async function dispatchEnterKey() {
    const event = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    document.dispatchEvent(event);
    await tick();
  }

  test('input handler cooperates with state controller to toggle availability and submit commands', async () => {
    await dispatchThroughSafe('core:disable_input', { message: 'Busy…' });

    expect(inputElement.disabled).toBe(true);

    inputElement.value = 'ignored';
    await dispatchEnterKey();
    expect(commandLog).toHaveLength(0);

    await dispatchThroughSafe('core:enable_input', {
      placeholder: 'Say something',
    });

    expect(inputElement.disabled).toBe(false);
    expect(inputElement.placeholder).toBe('Say something');

    inputElement.value = 'look around';
    await dispatchEnterKey();
    expect(commandLog).toEqual(['look around']);
    expect(inputElement.value).toBe('');

    inputHandler.setCommandCallback('not a function');
    inputElement.value = 'examine';
    await dispatchEnterKey();
    expect(commandLog).toEqual(['look around', 'examine']);

    const replacementCallback = jest.fn();
    inputHandler.setCommandCallback(replacementCallback);

    inputElement.value = 'say hi';
    await dispatchEnterKey();
    expect(replacementCallback).toHaveBeenCalledWith('say hi');
    expect(commandLog).toEqual(['look around', 'examine']);

    inputElement.value = '   ';
    await dispatchEnterKey();
    expect(replacementCallback).toHaveBeenCalledTimes(1);

    inputElement.value = 'clear me';
    inputHandler.clear();
    expect(inputElement.value).toBe('');

    await dispatchThroughSafe('core:disable_input', { message: 'Hold please' });
    expect(inputElement.disabled).toBe(true);

    inputHandler.disable();

    await dispatchThroughSafe('core:enable_input', {
      placeholder: 'Back again',
    });

    inputHandler.enable();

    await dispatchThroughSafe('core:disable_input', { message: 'Wrapped up' });
    expect(inputElement.disabled).toBe(true);

    const submitEvent = new window.Event('submit', {
      bubbles: true,
      cancelable: true,
    });
    formElement.dispatchEvent(submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);

    inputHandler.dispose();
    inputElement.value = 'after dispose';
    await dispatchEnterKey();
    expect(commandLog).toEqual(['look around', 'examine']);
    expect(replacementCallback).toHaveBeenCalledTimes(1);
  });

  test('input handler validates dependencies before wiring listeners', () => {
    const standaloneInput = document.createElement('input');
    document.body.appendChild(standaloneInput);

    expect(() =>
      new InputHandler(standaloneInput, () => {}, validatedEventDispatcher, {
        document: null,
        logger,
      })
    ).toThrow(
      'InputHandler requires a valid document with addEventListener and removeEventListener.'
    );

    expect(() =>
      new InputHandler(standaloneInput, () => {}, validatedEventDispatcher, {
        document,
        logger: {},
      })
    ).toThrow('InputHandler requires a logger implementing debug, warn, and error.');

    expect(() =>
      new InputHandler(null, () => {}, validatedEventDispatcher, {
        document,
        logger,
      })
    ).toThrow('InputHandler requires a valid HTMLInputElement.');

    expect(() =>
      new InputHandler(standaloneInput, () => {}, { dispatch: () => {} }, {
        document,
        logger,
      })
    ).toThrow('InputHandler requires a valid IValidatedEventDispatcher instance.');

    standaloneInput.remove();
  });

  test('input handler works with inputs outside forms', async () => {
    await dispatchThroughSafe('core:disable_input', { message: 'setup' });

    const looseInput = document.createElement('input');
    document.body.appendChild(looseInput);
    const looseCommands = [];

    const looseHandler = new InputHandler(
      looseInput,
      (command) => looseCommands.push(command),
      validatedEventDispatcher,
      {
        document,
        logger,
      }
    );

    looseHandler.enable();
    looseInput.value = 'loose command';
    const enterEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    looseInput.dispatchEvent(enterEvent);
    await tick();

    expect(looseCommands).toEqual(['loose command']);

    looseHandler.dispose();
    looseInput.remove();
  });

  test("global key handler dispatches inventory toggle events while ignoring focused inputs", async () => {
    const inventoryEvents = [];
    const unsubscribe = validatedEventDispatcher.subscribe(
      'ui:toggle_inventory',
      (event) => {
        inventoryEvents.push(event);
      }
    );
    activeSubscriptions.push(unsubscribe);

    const otherKeyEvent = new window.KeyboardEvent('keydown', {
      key: 'p',
      bubbles: true,
    });
    Object.defineProperty(otherKeyEvent, 'target', {
      configurable: true,
      value: document.getElementById('outside'),
    });
    document.dispatchEvent(otherKeyEvent);
    await tick();
    expect(inventoryEvents).toHaveLength(0);

    const outsideEvent = new window.KeyboardEvent('keydown', {
      key: 'i',
      bubbles: true,
    });
    Object.defineProperty(outsideEvent, 'target', {
      configurable: true,
      value: document.getElementById('outside'),
    });
    document.dispatchEvent(outsideEvent);
    await tick();

    expect(inventoryEvents).toHaveLength(1);
    expect(inventoryEvents[0]).toMatchObject({
      type: 'ui:toggle_inventory',
      payload: {},
    });

    const insideEvent = new window.KeyboardEvent('keydown', {
      key: 'i',
      bubbles: true,
    });
    Object.defineProperty(insideEvent, 'target', {
      configurable: true,
      value: inputElement,
    });
    inputElement.dispatchEvent(insideEvent);
    await tick();

    expect(inventoryEvents).toHaveLength(1);

    globalKeyHandler.dispose();

    const postDisposeEvent = new window.KeyboardEvent('keydown', {
      key: 'i',
      bubbles: true,
    });
    Object.defineProperty(postDisposeEvent, 'target', {
      configurable: true,
      value: document.getElementById('outside'),
    });
    document.dispatchEvent(postDisposeEvent);
    await tick();

    expect(inventoryEvents).toHaveLength(1);
  });

  test('global key handler validates dependencies', () => {
    expect(() => new GlobalKeyHandler(null, validatedEventDispatcher)).toThrow(
      'GlobalKeyHandler requires a valid Document.'
    );

    expect(() => new GlobalKeyHandler(document, {})).toThrow(
      'GlobalKeyHandler requires a valid IValidatedEventDispatcher instance.'
    );
  });

  test('global key handler logs when dispatch rejects', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const rejectingDispatcher = {
      dispatch: jest.fn(() => Promise.reject(new Error('dispatch failed'))),
    };

    const failingHandler = new GlobalKeyHandler(document, rejectingDispatcher);

    const event = new window.KeyboardEvent('keydown', {
      key: 'I',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: document.getElementById('outside'),
    });
    document.dispatchEvent(event);
    await tick();

    expect(rejectingDispatcher.dispatch).toHaveBeenCalledWith(
      'ui:toggle_inventory',
      {}
    );
    expect(errorSpy).toHaveBeenCalled();

    failingHandler.dispose();
    errorSpy.mockRestore();
  });

  test('input state controller dispatches focus telemetry via safe dispatcher', async () => {
    const gainedEvents = [];
    const lostEvents = [];

    const unsubscribeGained = validatedEventDispatcher.subscribe(
      'core:speech_input_gained_focus',
      (event) => {
        gainedEvents.push(event);
      }
    );
    const unsubscribeLost = validatedEventDispatcher.subscribe(
      'core:speech_input_lost_focus',
      (event) => {
        lostEvents.push(event);
      }
    );

    activeSubscriptions.push(unsubscribeGained, unsubscribeLost);

    const focusEvent = new window.FocusEvent('focus', { bubbles: true });
    inputElement.dispatchEvent(focusEvent);
    await tick();

    expect(gainedEvents).toHaveLength(1);
    expect(gainedEvents[0].type).toBe('core:speech_input_gained_focus');
    expect(typeof gainedEvents[0].payload.timestamp).toBe('number');

    const blurEvent = new window.FocusEvent('blur', { bubbles: true });
    inputElement.dispatchEvent(blurEvent);
    await tick();

    expect(lostEvents).toHaveLength(1);
    expect(lostEvents[0].type).toBe('core:speech_input_lost_focus');
    expect(typeof lostEvents[0].payload.timestamp).toBe('number');
  });
});
