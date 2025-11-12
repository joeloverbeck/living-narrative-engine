/**
 * @file Advanced integration coverage for Character Concepts Manager controller
 * @description Exercises search analytics, statistics, cross-tab sync, and notification flows
 */

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

class RecordingBroadcastChannel {
  static instances = [];

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.messages = [];
    this._listeners = new Set();
    RecordingBroadcastChannel.instances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
    for (const handler of this._listeners) {
      handler({ data: message });
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

let originalRequestAnimationFrame;

function setupConceptsManagerDOM() {
  document.body.innerHTML = createMinimalModalDOM();
  const resultsElement = document.getElementById('concepts-results');
  const parent = resultsElement?.parentElement;
  if (parent) {
    const panelTitle = document.createElement('div');
    panelTitle.className = 'cb-panel-title';
    panelTitle.textContent = 'Concepts';
    parent.insertBefore(panelTitle, resultsElement);
  }
}

describe('Character Concepts Manager - advanced integration flows', () => {
  let controller;
  let container;
  let logger;
  let eventBus;
  let characterBuilderService;
  let originalBroadcastChannel;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    originalBroadcastChannel = global.BroadcastChannel;
    RecordingBroadcastChannel.instances = [];
    global.BroadcastChannel = RecordingBroadcastChannel;

    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };

    if (!global.indexedDB) {
      global.indexedDB = createFastIndexedDBMock();
    }

    sessionStorage.clear();
    setupConceptsManagerDOM();

    const baseTimestamp = Date.now() - 3600_000;
    const existingConcepts = [
      {
        id: 'concept-1',
        concept:
          'A mysterious strategist who always plans three steps ahead of rivals.',
        created: baseTimestamp,
        updated: baseTimestamp,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      },
      {
        id: 'concept-2',
        concept: 'An impulsive inventor chasing impossible ideas.',
        created: baseTimestamp,
        updated: baseTimestamp,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      },
      {
        id: 'concept-3',
        concept: 'A disciplined archivist guarding forbidden knowledge.',
        created: baseTimestamp,
        updated: baseTimestamp,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      },
      {
        id: 'concept-4',
        concept: 'A charismatic bard weaving reality with stories.',
        created: baseTimestamp,
        updated: baseTimestamp,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      },
    ];

    characterBuilderService = createMockCharacterBuilderService({
      existingConcepts,
    });
    characterBuilderService.getThematicDirections.mockImplementation((id) => {
      switch (id) {
        case 'concept-1':
          return Promise.resolve([{ id: 'dir-1' }, { id: 'dir-2' }]);
        case 'concept-2':
          return Promise.resolve([]);
        case 'concept-3':
          return Promise.resolve([{ id: 'dir-3' }]);
        case 'concept-4':
          return Promise.resolve([
            { id: 'dir-4' },
            { id: 'dir-5' },
            { id: 'dir-6' },
          ]);
        default:
          return Promise.resolve([]);
      }
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

    await controller.initialize();
    await flushPromises();
  });

  afterEach(() => {
    controller?.destroy?.();
    controller = null;

    document.body.innerHTML = '';
    sessionStorage.clear();

    RecordingBroadcastChannel.instances = [];
    if (originalBroadcastChannel) {
      global.BroadcastChannel = originalBroadcastChannel;
    } else {
      delete global.BroadcastChannel;
    }

    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }

    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it('tracks statistics, enhances search UI, and persists search state end-to-end', async () => {
    const advancedStats = document.querySelector('.advanced-stats');
    expect(advancedStats).toBeTruthy();

    expect(document.getElementById('avg-directions').textContent).toBe('1.5');
    expect(document.getElementById('completion-rate').textContent).toBe('75%');
    expect(document.getElementById('max-directions').textContent).toBe('3');

    const progressFill = document.querySelector('.progress-fill');
    expect(progressFill.style.width).toBe('75%');
    expect(progressFill.classList.contains('good')).toBe(true);
    expect(document.querySelector('.concepts-complete').textContent).toBe('3');
    expect(document.querySelector('.concepts-total').textContent).toBe('4');

    const searchInput = document.getElementById('concept-search');
    searchInput.value = 'mysterious strategist';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 360));
    await flushPromises();

    const highlightedCard = document.querySelector('.concept-card .concept-text');
    expect(highlightedCard.innerHTML).toContain('<mark>mysterious</mark>');

    const statusElement = document.querySelector('.search-status');
    expect(statusElement).toBeTruthy();
    expect(statusElement.textContent).toContain('Showing 1 of 4 concepts');

    const inlineClearButton = document.querySelector('.clear-search-inline');
    expect(inlineClearButton).toBeTruthy();

    const trailingClearButton = document.querySelector('.search-clear-btn');
    expect(trailingClearButton).toBeTruthy();

    const persistedState = JSON.parse(
      sessionStorage.getItem('conceptsSearchState')
    );
    expect(persistedState.filter).toBe('mysterious strategist');
    expect(persistedState.resultCount).toBe(1);
    expect(Array.isArray(persistedState.analytics.recentSearches)).toBe(true);

    expect(controller._testExports.searchAnalytics.searches.length).toBe(1);

    searchInput.value = 'no matches';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 360));
    await flushPromises();

    const noResults = document.querySelector('.no-search-results');
    expect(noResults).toBeTruthy();
    expect(noResults.textContent).toContain('No concepts match your search');

    noResults.querySelector('#clear-search-btn').click();
    await flushPromises();

    expect(searchInput.value).toBe('');
    expect(document.querySelector('.search-status')).toBeNull();
    expect(document.querySelector('.search-clear-btn')).toBeNull();
    expect(controller._testExports.searchFilter).toBe('');
  });

  it('syncs cross-tab messages, animations, and notifications through production collaborators', async () => {
    const singleConceptService = createMockCharacterBuilderService({
      existingConcepts: [
        {
          id: 'concept-existing',
          concept: 'An apprentice mage struggling to control volatile magic.',
          created: Date.now() - 7200_000,
          updated: Date.now() - 7200_000,
          createdAt: Date.now() - 7200_000,
          updatedAt: Date.now() - 7200_000,
        },
      ],
    });
    singleConceptService.getThematicDirections.mockResolvedValue([]);

    controller.destroy();
    await flushPromises();

    RecordingBroadcastChannel.instances = [];
    setupConceptsManagerDOM();

    container = await createTestContainer({
      mockServices: {
        [tokens.CharacterBuilderService]: singleConceptService,
      },
    });

    logger = container.resolve(tokens.ILogger);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);

    controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService: singleConceptService,
      eventBus,
    });

    await controller.initialize();
    await flushPromises();

    const channel = RecordingBroadcastChannel.instances.at(-1);
    expect(channel).toBeTruthy();
    expect(channel.messages.some((msg) => msg.type === 'tab-opened')).toBe(true);
    expect(channel.messages.some((msg) => msg.type === 'leader-elected')).toBe(
      true
    );

    const initialCalls = singleConceptService.getAllCharacterConcepts.mock.calls
      .length;
    channel.postMessage({
      type: 'data-changed',
      tabId: 'other-tab',
      changeType: 'concept-updated',
      data: {},
    });
    await new Promise((resolve) => setTimeout(resolve, 520));
    await flushPromises();

    expect(
      singleConceptService.getAllCharacterConcepts.mock.calls.length
    ).toBeGreaterThan(initialCalls);

    const conceptCard = document.querySelector('.concept-card');
    expect(conceptCard.querySelector('.direction-count strong').textContent).toBe(
      '0'
    );

    eventBus.dispatch('core:thematic_directions_generated', {
      conceptId: 'concept-existing',
      directions: [{ id: 'dir-a' }, { id: 'dir-b' }, { id: 'dir-c' }],
      count: 3,
    });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 650));

    expect(
      conceptCard.querySelector('.direction-count strong').textContent
    ).toBe('3');
    expect(conceptCard.classList.contains('directions-generated')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(conceptCard.classList.contains('directions-generated')).toBe(false);

    expect(
      channel.messages.some(
        (msg) =>
          msg.type === 'data-changed' &&
          msg.changeType === 'directions-generated' &&
          msg.data.directionCount === 3
      )
    ).toBe(true);

    const notificationMessages = Array.from(
      document.querySelectorAll('.notification-message')
    ).map((node) => node.textContent);
    expect(
      notificationMessages.some((message) =>
        message.includes('✨ 3 thematic directions generated')
      )
    ).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 180));
    const milestone = document.querySelector('.milestone-notification');
    expect(milestone).toBeTruthy();
    expect(milestone.classList.contains('show')).toBe(true);

    const originalEnvForDeletion = process.env.NODE_ENV;
    process.env.NODE_ENV = 'integration';
    eventBus.dispatch('core:character_concept_deleted', {
      conceptId: 'concept-existing',
      cascadedDirections: 2,
    });
    await flushPromises();
    process.env.NODE_ENV = originalEnvForDeletion;

    const deletionMessages = Array.from(
      document.querySelectorAll('.notification-message')
    ).map((node) => node.textContent);
    expect(
      deletionMessages.some((message) =>
        message.includes('🗑️ Character concept deleted (2 directions also removed)')
      )
    ).toBe(true);

    controller.destroy();
    await flushPromises();
    expect(channel.closed).toBe(true);
  });
});

