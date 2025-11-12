import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  createFastIndexedDBMock,
  createMinimalModalDOM,
  createMockCharacterBuilderService,
  createTestContainer,
} from '../../common/testContainerConfig.js';
import { flushPromises } from '../../common/testWaitUtils.js';

class TestBroadcastChannel {
  static instances = [];

  constructor(name) {
    this.name = name;
    this.closed = false;
    this._listeners = new Set();
    TestBroadcastChannel.instances.push(this);
  }

  postMessage(message) {
    for (const listener of this._listeners) {
      listener({ data: message });
    }
  }

  addEventListener(type, handler) {
    if (type === 'message') {
      this._listeners.add(handler);
    }
  }

  removeEventListener(type, handler) {
    if (type === 'message') {
      this._listeners.delete(handler);
    }
  }

  close() {
    this.closed = true;
  }
}

describe('Character Concepts Manager - lifecycle integration', () => {
  let originalBroadcastChannel;
  let controller;
  let container;
  let logger;
  let eventBus;
  let characterBuilderService;
  let originalEnv;
  let conceptTextKeydownHandler;

  beforeEach(async () => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    originalBroadcastChannel = global.BroadcastChannel;
    TestBroadcastChannel.instances = [];
    global.BroadcastChannel = TestBroadcastChannel;

    if (!global.indexedDB) {
      global.indexedDB = createFastIndexedDBMock();
    }

    document.body.innerHTML = createMinimalModalDOM();

    const existingConcepts = [
      {
        id: 'concept-existing',
        concept:
          'A courageous explorer with a mysterious past seeking ancient relics.',
        created: Date.now() - 86400000,
        updated: Date.now() - 3600000,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000,
      },
    ];

    characterBuilderService = createMockCharacterBuilderService({
      existingConcepts,
    });

    container = await createTestContainer({
      mockServices: {
        [tokens.CharacterBuilderService]: characterBuilderService,
      },
    });

    logger = container.resolve(tokens.ILogger);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);

    controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
    });

    const originalAddEventListener = controller._addEventListener.bind(controller);
    conceptTextKeydownHandler = undefined;
    controller._addEventListener = function (elementId, eventName, handler) {
      if (elementId === 'conceptText' && eventName === 'keydown') {
        conceptTextKeydownHandler = handler;
      }
      return originalAddEventListener(elementId, eventName, handler);
    };

    await controller.initialize();
    controller._addEventListener = originalAddEventListener;
    await flushPromises();
  });

  afterEach(() => {
    controller?.destroy?.();
    document.body.innerHTML = '';
    jest.clearAllMocks();

    if (originalBroadcastChannel) {
      global.BroadcastChannel = originalBroadcastChannel;
    } else {
      delete global.BroadcastChannel;
    }

    process.env.NODE_ENV = originalEnv;
  });

  it('closes modals with animation and cleans up broadcast resources on destroy', async () => {
    const modal = document.getElementById('concept-modal');
    const createButton = document.getElementById('create-concept-btn');

    createButton.click();
    await flushPromises();
    expect(modal.style.display).toBe('flex');

    modal.animate = jest.fn().mockImplementation(() => ({
      addEventListener: (event, handler) => {
        if (event === 'finish') {
          handler();
        }
      },
      cancel: jest.fn(),
      playState: 'finished',
    }));

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    controller._handleRemoteDataChange('concept-updated', { id: 'concept-existing' });

    process.env.NODE_ENV = 'integration';
    controller._closeConceptModal();
    process.env.NODE_ENV = 'test';

    expect(modal.style.display).toBe('none');
    expect(modal.animate).toHaveBeenCalledTimes(1);

    expect(TestBroadcastChannel.instances.length).toBeGreaterThan(0);
    const channel = TestBroadcastChannel.instances[0];
    expect(channel.closed).toBe(false);

    const callsBeforeDestroy = clearTimeoutSpy.mock.calls.length;
    controller.destroy();
    controller = null;

    expect(channel.closed).toBe(true);
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBeforeDestroy);

    clearTimeoutSpy.mockRestore();
  });

  it('wires search, keyboard, and modal interactions through production handlers', async () => {
    const conceptsResults = document.getElementById('concepts-results');
    expect(conceptsResults.querySelector('.concept-card')).toBeTruthy();

    const searchInput = document.getElementById('concept-search');
    controller._testExports.searchFilter = 'explorer';
    searchInput.value = 'explorer';

    const clearSearchSpy = jest.spyOn(controller, '_clearSearch');
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    searchInput.dispatchEvent(escapeEvent);
    expect(clearSearchSpy).toHaveBeenCalledTimes(1);

    controller._testExports.searchFilter = 'explorer';
    searchInput.value = 'explorer';
    const refreshedCard = conceptsResults.querySelector('.concept-card');
    const focusSpy = jest
      .spyOn(refreshedCard, 'focus')
      .mockImplementation(() => {});
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    searchInput.dispatchEvent(enterEvent);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(conceptTextKeydownHandler).toBeInstanceOf(Function);
    const shortcutSaveSpy = jest.spyOn(controller, '_handleConceptSave');
    controller._getElement('saveConceptBtn').disabled = false;
    const preventDefault = jest.fn();
    conceptTextKeydownHandler({
      key: 'Enter',
      ctrlKey: true,
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(shortcutSaveSpy).toHaveBeenCalledTimes(1);
    shortcutSaveSpy.mockRestore();

    const createFirstButton = document.getElementById('create-first-btn');
    createFirstButton.click();
    await flushPromises();

    const conceptText = document.getElementById('concept-text');
    const charCount = document.getElementById('char-count');
    const saveButton = document.getElementById('save-concept-btn');
    conceptText.value = 'A detailed character concept that clearly exceeds fifty characters.';
    const inputEvent = new Event('input', { bubbles: true });
    conceptText.dispatchEvent(inputEvent);
    expect(charCount.textContent).toBe(
      `${conceptText.value.length}/6000`
    );
    expect(saveButton.disabled).toBe(false);


    const deleteModal = document.getElementById('delete-confirmation-modal');
    deleteModal.style.display = 'block';
    const closeDeleteSpy = jest.spyOn(controller, '_closeDeleteModal');
    deleteModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(closeDeleteSpy).toHaveBeenCalledTimes(1);

    controller._testExports.deleteHandler = jest.fn();
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    confirmDeleteBtn.click();
    expect(controller._testExports.deleteHandler).toHaveBeenCalledTimes(1);

    focusSpy.mockRestore();
  });
});
