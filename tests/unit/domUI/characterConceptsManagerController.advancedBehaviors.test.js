import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';
import { FormValidationHelper } from '../../../src/shared/characterBuilder/formValidationHelper.js';

describe('CharacterConceptsManagerController advanced behaviors', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;
  let originalBroadcastChannel;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
    originalBroadcastChannel = global.BroadcastChannel;
  });

  afterEach(async () => {
    if (originalBroadcastChannel === undefined) {
      delete global.BroadcastChannel;
    } else {
      global.BroadcastChannel = originalBroadcastChannel;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    await testBase.cleanup();
  });

  it('calculates average search results and resolves display text formatting', () => {
    controller._testExports.searchAnalytics = {
      searches: [
        { resultCount: 3 },
        { resultCount: 5 },
        { resultCount: 2 },
      ],
      noResultSearches: [],
    };

    expect(controller._calculateAverageResults()).toBe(3);

    const highlightSpy = jest
      .spyOn(controller, '_highlightSearchTerms')
      .mockReturnValue('highlighted-text');
    controller._testExports.searchFilter = 'hero';
    expect(
      controller._getDisplayText({ concept: 'heroic tale' }, 40)
    ).toBe('highlighted-text');
    expect(highlightSpy).toHaveBeenCalledWith(expect.any(String), 'hero');

    highlightSpy.mockRestore();
    const escapeSpy = jest
      .spyOn(controller, '_escapeHtml')
      .mockReturnValue('escaped-text');
    controller._testExports.searchFilter = '';
    expect(
      controller._getDisplayText({ text: '<script>alert(1)</script>' }, 40)
    ).toBe('escaped-text');
    expect(escapeSpy).toHaveBeenCalled();
  });

  it('initializes cross-tab synchronization and runs cleanup tasks', () => {
    const postMessage = jest.fn((message) => {
      if (!postMessage.tabId) {
        postMessage.tabId = message.tabId;
      }
    });
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const close = jest.fn();
    let cleanupTask;

    global.BroadcastChannel = jest.fn(() => ({
      addEventListener,
      removeEventListener,
      postMessage,
      close,
    }));

    const registerCleanupSpy = jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation((task) => {
        cleanupTask = task;
      });
    const performLeaderElectionSpy = jest.spyOn(
      controller,
      '_performLeaderElection'
    );
    const infoSpy = jest.spyOn(controller.logger, 'info');

    controller._initializeCrossTabSync();

    expect(global.BroadcastChannel).toHaveBeenCalledWith(
      'character-concepts-manager'
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    expect(performLeaderElectionSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      'Cross-tab sync initialized',
      expect.objectContaining({ tabId: expect.any(String) })
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tab-opened', tabId: expect.any(String) })
    );

    cleanupTask();
    expect(removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    expect(close).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tab-closed' })
    );

    registerCleanupSpy.mockRestore();
  });

  it('disables cross-tab sync when BroadcastChannel is unavailable', () => {
    const warnSpy = jest.spyOn(controller.logger, 'warn');
    global.BroadcastChannel = jest.fn(() => {
      throw new Error('not supported');
    });

    controller._initializeCrossTabSync();

    expect(warnSpy).toHaveBeenCalledWith(
      'BroadcastChannel not supported, cross-tab sync disabled',
      expect.any(Error)
    );
    expect(() => controller._broadcastMessage({ type: 'test' })).not.toThrow();
  });

  it('handles cross-tab messages and reports errors for invalid payloads', () => {
    let messageHandler;
    let capturedTabId;
    const channelMock = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      }),
      removeEventListener: jest.fn(),
      postMessage: jest.fn((message) => {
        if (!capturedTabId) {
          capturedTabId = message.tabId;
        }
      }),
      close: jest.fn(),
    };

    global.BroadcastChannel = jest.fn(() => channelMock);
    jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation(() => {});
    controller._initializeCrossTabSync();

    const performLeaderElectionSpy = jest
      .spyOn(controller, '_performLeaderElection')
      .mockImplementation(() => {});
    const remoteChangeSpy = jest
      .spyOn(controller, '_handleRemoteDataChange')
      .mockImplementation(() => {});
    const warnSpy = jest.spyOn(controller.logger, 'warn');
    const errorSpy = jest.spyOn(controller.logger, 'error');
    const debugSpy = jest.spyOn(controller.logger, 'debug');

    const baseNow = Date.now();
    let currentNow = baseNow;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentNow);

    const initialDebugCalls = debugSpy.mock.calls.length;
    messageHandler({
      data: { type: 'tab-opened', timestamp: baseNow - 60000 },
    });
    expect(debugSpy.mock.calls.length).toBe(initialDebugCalls);

    currentNow = baseNow + 1000;
    messageHandler({ data: { type: 'tab-opened' } });
    expect(performLeaderElectionSpy).toHaveBeenCalledTimes(1);

    messageHandler({ data: { type: 'tab-closed', wasLeader: true } });
    expect(performLeaderElectionSpy).toHaveBeenCalledTimes(2);

    const otherTabId = `${capturedTabId}-other`;
    messageHandler({
      data: { type: 'data-changed', tabId: otherTabId, changeType: 'update', data: { id: 1 } },
    });
    expect(remoteChangeSpy).toHaveBeenCalledWith('update', { id: 1 });

    messageHandler({ data: { type: 'leader-elected', tabId: capturedTabId } });

    messageHandler({ data: { type: 'unknown' } });
    expect(warnSpy).toHaveBeenCalledWith('Unknown cross-tab message type', {
      type: 'unknown',
    });

    remoteChangeSpy.mockImplementationOnce(() => {
      throw new Error('remote failed');
    });
    messageHandler({
      data: { type: 'data-changed', tabId: otherTabId, changeType: 'again', data: {} },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Error handling cross-tab message',
      expect.any(Error),
      expect.objectContaining({ type: 'data-changed' })
    );

    nowSpy.mockRestore();
  });

  it('broadcasts messages with metadata and handles failures gracefully', () => {
    const channelMock = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn((message) => {
        channelMock.lastMessage = message;
      }),
      close: jest.fn(),
    };

    global.BroadcastChannel = jest.fn(() => channelMock);
    jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation(() => {});
    controller._initializeCrossTabSync();

    const errorSpy = jest.spyOn(controller.logger, 'error');

    controller._broadcastMessage({ type: 'custom', payload: 42 });
    expect(channelMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'custom',
        payload: 42,
        tabId: expect.any(String),
        timestamp: expect.any(Number),
      })
    );

    channelMock.postMessage.mockImplementation(() => {
      throw new Error('post failed');
    });
    controller._broadcastMessage({ type: 'custom', payload: 42 });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to broadcast message',
      expect.any(Error),
      { type: 'custom', payload: 42 }
    );

    controller._cleanup();
    expect(() => controller._broadcastMessage({ type: 'after-cleanup' })).not.toThrow();
  });

  it('broadcasts data-change events through helper', () => {
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});

    controller._broadcastDataChange('updated', { id: 'c-1' });

    expect(broadcastSpy).toHaveBeenCalledWith({
      type: 'data-changed',
      changeType: 'updated',
      data: { id: 'c-1' },
    });
  });

  it('debounces remote data changes before reloading', () => {
    jest.useFakeTimers();
    const loadSpy = jest
      .spyOn(controller, '_loadConceptsData')
      .mockImplementation(() => {});
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    controller._handleRemoteDataChange('update', {});
    controller._handleRemoteDataChange('update', {});

    expect(clearTimeoutSpy).toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('performs leader election and schedules heartbeats', () => {
    let capturedInterval;
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    const clearIntervalSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});
    jest
      .spyOn(controller, '_setInterval')
      .mockImplementation((callback, delay) => {
        expect(delay).toBe(30000);
        capturedInterval = callback;
        return 101;
      });

    controller._performLeaderElection();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leader-elected' })
    );
    capturedInterval();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leader-elected' })
    );

    controller._performLeaderElection();
    expect(clearIntervalSpy).toHaveBeenCalledWith(101);
  });

  it('cleans up broadcast resources and animations on cleanup', () => {
    const channelMock = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
      close: jest.fn(),
    };
    global.BroadcastChannel = jest.fn(() => channelMock);
    jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation(() => {});
    jest
      .spyOn(controller, '_setInterval')
      .mockImplementation(() => 777);
    const clearIntervalSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});
    const cleanupAnimationsSpy = jest
      .spyOn(controller, '_cleanupAnimations')
      .mockImplementation(() => {});

    controller._initializeCrossTabSync();
    controller._cleanup();

    expect(channelMock.close).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledWith(777);
    expect(cleanupAnimationsSpy).toHaveBeenCalled();
  });

  it('detects visible concepts and removes cards with empty-state handling', () => {
    const results = controller._getElement('conceptsResults');
    const realQuerySelector = Element.prototype.querySelector;
    const realAppendChild = Element.prototype.appendChild;
    results.querySelector = function (selector) {
      return realQuerySelector.call(this, selector);
    };
    results.appendChild = function (child) {
      return realAppendChild.call(this, child);
    };

    const card = document.createElement('div');
    card.setAttribute('data-concept-id', 'concept-visible');
    card.className = 'concept-card';
    results.appendChild(card);
    controller._testExports.conceptsData = [];

    expect(controller._isConceptVisible('concept-visible')).toBe(true);

    const showStateSpy = jest
      .spyOn(controller, '_showState')
      .mockImplementation(() => {});
    jest.useFakeTimers();
    controller._removeConceptCard('concept-visible');
    expect(card.classList.contains('concept-removing')).toBe(true);
    jest.runAllTimers();
    expect(showStateSpy).toHaveBeenCalledWith('empty');
  });

  it('animates directions updates and status transitions', () => {
    jest.useFakeTimers();
    const results = controller._getElement('conceptsResults');
    const realQuerySelector = Element.prototype.querySelector;
    const realAppendChild = Element.prototype.appendChild;
    results.querySelector = function (selector) {
      return realQuerySelector.call(this, selector);
    };
    results.appendChild = function (child) {
      return realAppendChild.call(this, child);
    };

    const card = document.createElement('div');
    card.setAttribute('data-concept-id', 'concept-animate');

    const countWrapper = document.createElement('div');
    countWrapper.className = 'direction-count';
    const strong = document.createElement('strong');
    strong.textContent = '0';
    countWrapper.appendChild(strong);
    card.appendChild(countWrapper);

    const status = document.createElement('div');
    status.className = 'concept-status draft';
    card.appendChild(status);

    results.appendChild(card);

    const animateNumberSpy = jest
      .spyOn(controller, '_animateNumberChange')
      .mockImplementation(() => {});

    controller._animateDirectionsGenerated('concept-animate', 0, 3);

    expect(card.classList.contains('directions-generated')).toBe(true);
    expect(animateNumberSpy).toHaveBeenCalledWith(strong, 0, 3);
    expect(status.classList.contains('completed')).toBe(true);
    expect(status.textContent).toBe('Has Directions');

    jest.advanceTimersByTime(1000);
    expect(card.classList.contains('directions-generated')).toBe(false);
  });

  it('displays notifications with close handlers and auto-dismiss', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    const infoSpy = jest.spyOn(controller.logger, 'info');

    controller._showNotification('Hello world', 'success');

    const container = document.body.querySelector('.notification-container');
    expect(container).not.toBeNull();
    const notification = container.querySelector('.notification');
    expect(notification).not.toBeNull();
    expect(notification.className).toContain('notification-success');
    expect(infoSpy).not.toHaveBeenCalledWith('Notification:', 'Hello world');

    const closeButton = notification.querySelector('.notification-close');
    closeButton.click();
    jest.runOnlyPendingTimers();

    controller._showNotification('Auto close', 'info');
    jest.advanceTimersByTime(5000);
    jest.runOnlyPendingTimers();

    jest.runAllTimers();
    expect(container.querySelectorAll('.notification').length).toBe(0);
  });

  it('checks milestones for creation and direction completion', () => {
    const showMilestoneSpy = jest
      .spyOn(controller, '_showMilestone')
      .mockImplementation(() => {});
    jest
      .spyOn(controller, '_calculateStatistics')
      .mockReturnValue({
        totalConcepts: 10,
        completionRate: 100,
        conceptsWithDirections: 1,
      });

    controller._checkMilestones('created');
    controller._checkMilestones('directions-added');

    expect(showMilestoneSpy).toHaveBeenCalledWith(
      '🎊 10 Concepts Created!'
    );
    expect(showMilestoneSpy).toHaveBeenCalledWith(
      '⭐ All Concepts Have Directions!'
    );
  });

  it('animates number changes over time', () => {
    jest.useFakeTimers();
    const element = document.createElement('span');

    controller._animateNumberChange(element, 0, 5);

    jest.advanceTimersByTime(500);
    expect(element.textContent).toBe('5');
  });

  it('cleans up active animation intervals', () => {
    const element = document.createElement('div');
    element.setAttribute('data-animation', 'pulse');
    element.animationInterval = 1234;
    document.body.appendChild(element);

    const clearIntervalSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});

    controller._cleanupAnimations();

    expect(clearIntervalSpy).toHaveBeenCalledWith(1234);
  });

  it('shows feedback when concepts are created and deleted', () => {
    jest.useFakeTimers();
    const results = controller._getElement('conceptsResults');
    const realQuerySelector = Element.prototype.querySelector;
    const realAppendChild = Element.prototype.appendChild;
    results.querySelector = function (selector) {
      return realQuerySelector.call(this, selector);
    };
    results.appendChild = function (child) {
      return realAppendChild.call(this, child);
    };

    const newCard = document.createElement('div');
    newCard.setAttribute('data-concept-id', 'created-id');
    newCard.scrollIntoView = jest.fn();
    results.appendChild(newCard);

    const notificationSpy = jest
      .spyOn(controller, '_showNotification')
      .mockImplementation(() => {});

    controller._showConceptCreatedFeedback({ id: 'created-id' });
    jest.advanceTimersByTime(100);
    expect(newCard.classList.contains('concept-new')).toBe(true);
    jest.advanceTimersByTime(2000);
    expect(newCard.classList.contains('concept-new')).toBe(false);
    expect(notificationSpy).toHaveBeenCalledWith(
      '✅ Character concept created successfully',
      'success'
    );

    controller._showConceptDeletedFeedback(2);
    controller._showConceptDeletedFeedback(0);
    expect(notificationSpy).toHaveBeenCalledWith(
      '🗑️ Character concept deleted (2 directions also removed)',
      'info'
    );
    expect(notificationSpy).toHaveBeenCalledWith(
      '🗑️ Character concept deleted',
      'info'
    );
  });

  it('destroys controller resources and unsubscribes from events', async () => {
    const channelMock = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
      close: jest.fn(),
    };
    global.BroadcastChannel = jest.fn(() => channelMock);
    jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation(() => {});
    controller._initializeCrossTabSync();

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    controller._handleRemoteDataChange('update', {});

    controller.destroy();
    await new Promise((resolve) => setImmediate(resolve));

    expect(channelMock.close).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    const events = [
      'core:character_concept_created',
      'core:character_concept_updated',
      'core:character_concept_deleted',
      'core:thematic_directions_generated',
    ];
    events.forEach((eventName) => {
      expect(testBase.mocks.eventBus.unsubscribe).toHaveBeenCalledWith(
        eventName,
        expect.any(Function)
      );
    });
  });

  it('caches DOM elements and configures event listeners', () => {
    const cacheSpy = jest.spyOn(controller, '_cacheElementsFromMap');

    controller._cacheElements();
    expect(cacheSpy).toHaveBeenCalled();

    const addEventListenerSpy = jest.spyOn(controller, '_addEventListener');
    const addDebouncedListenerSpy = jest.spyOn(
      controller,
      '_addDebouncedListener'
    );
    const subscribeSpy = jest.spyOn(controller, '_subscribeToEvent');

    controller._setupEventListeners();

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addDebouncedListenerSpy).toHaveBeenCalledWith(
      'conceptSearch',
      'input',
      expect.any(Function),
      300
    );
    expect(subscribeSpy).toHaveBeenCalledWith(
      'core:thematic_directions_generated',
      expect.any(Function)
    );
  });

  it('updates character counts through the validation helper', () => {
    const updateSpy = jest.spyOn(FormValidationHelper, 'updateCharacterCount');
    controller._updateCharCount();
    expect(updateSpy).toHaveBeenCalled();
  });
});
