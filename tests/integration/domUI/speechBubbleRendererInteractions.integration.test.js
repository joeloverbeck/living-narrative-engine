/**
 * @file Integration tests for SpeechBubbleRenderer covering full DOM interactions.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import { SpeechBubbleRenderer } from '../../../src/domUI/speechBubbleRenderer.js';
import EventBus from '../../../src/events/eventBus.js';
import { EntityDisplayDataProvider } from '../../../src/entities/entityDisplayDataProvider.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import {
  NAME_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
  PORTRAIT_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { PORTRAIT_CLICKED } from '../../../src/constants/eventIds.js';
import {
  copyToClipboard,
  showCopyFeedback,
} from '../../../src/domUI/helpers/clipboardUtils.js';

jest.mock('../../../src/domUI/helpers/clipboardUtils.js', () => {
  const actual = jest.requireActual(
    '../../../src/domUI/helpers/clipboardUtils.js'
  );
  return {
    ...actual,
    copyToClipboard: jest.fn(),
    showCopyFeedback: jest.fn(),
  };
});

/**
 *
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param root0
 * @param root0.id
 * @param root0.definitionId
 * @param root0.components
 * @param root0.overrides
 */
function buildEntity({ id, definitionId, components, overrides }) {
  const definition = new EntityDefinition(definitionId, {
    components,
  });
  const instanceData = new EntityInstanceData(id, definition, overrides ?? {});
  return new Entity(instanceData);
}

describe('SpeechBubbleRenderer integration coverage', () => {
  let logger;
  let documentContext;
  let domElementFactory;
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let entityManager;
  let entityStore;
  let entityDisplayDataProvider;
  let locationDisplayService;
  let baseDependencies;

  beforeEach(() => {
    logger = createLoggerMock();
    document.body.innerHTML = '<div id="outputDiv"></div><div id="message-list"></div>';
    copyToClipboard.mockResolvedValue(true);
    showCopyFeedback.mockImplementation(() => {});
    documentContext = new DocumentContext(document);
    domElementFactory = new DomElementFactory(documentContext);
    eventBus = new EventBus({ logger });

    validatedEventDispatcher = {
      dispatch: jest.fn((event) => eventBus.dispatch(event.type, event.payload)),
      subscribe: jest.fn((eventName, handler) => eventBus.subscribe(eventName, handler)),
    };

    safeEventDispatcher = { dispatch: jest.fn() };
    entityStore = new Map();
    entityManager = {
      getEntityInstance: jest.fn((entityId) => entityStore.get(entityId) ?? null),
    };

    locationDisplayService = {
      getLocationDetails: jest.fn(),
      getLocationPortraitData: jest.fn(),
    };

    entityDisplayDataProvider = new EntityDisplayDataProvider({
      entityManager,
      logger,
      safeEventDispatcher,
      locationDisplayService,
    });

    baseDependencies = {
      logger,
      documentContext,
      validatedEventDispatcher,
      entityManager,
      domElementFactory,
      entityDisplayDataProvider,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    copyToClipboard.mockReset();
    showCopyFeedback.mockReset();
    jest.restoreAllMocks();
  });

  /**
   *
   * @param config
   */
  function registerEntity(config) {
    const entity = buildEntity(config);
    entityStore.set(config.id, entity);
    return entity;
  }

  it('renders copy-all for player speech without metadata and copies only the speech text', () => {
    registerEntity({
      id: 'player-entity',
      definitionId: 'core:player',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Player Character' },
        [PLAYER_TYPE_COMPONENT_ID]: { type: 'human' },
        [PLAYER_COMPONENT_ID]: { active: true },
      },
    });

    const speechBubbleRenderer = new SpeechBubbleRenderer(baseDependencies);

    speechBubbleRenderer.renderSpeech({
      entityId: 'player-entity',
      speechContent: 'Stay <em>calm</em> *nod*',
      allowHtml: true,
    });

    const entry = document.querySelector('.speech-entry');
    const metaContainer = entry?.querySelector('.speech-meta');
    expect(metaContainer).not.toBeNull();

    const buttons = Array.from(metaContainer?.querySelectorAll('.meta-btn') ?? []);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].classList.contains('copy-all')).toBe(true);

    buttons[0].dispatchEvent(new Event('click', { bubbles: true }));

    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard).toHaveBeenCalledWith(
      'Player Character says: "Stay calm *nod*"'
    );
  });

  it('appends copy-all after existing meta buttons and assembles payloads for speech and thought bubbles', () => {
    registerEntity({
      id: 'npc-with-meta',
      definitionId: 'core:npc',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Archivist' },
      },
    });

    const speechBubbleRenderer = new SpeechBubbleRenderer(baseDependencies);

    speechBubbleRenderer.renderSpeech({
      entityId: 'npc-with-meta',
      speechContent: 'Observe the relic',
      thoughts: 'Need to log this',
      notes: [
        {
          text: 'Recovered fragment catalogued.',
          subject: 'Archivist Log',
          context: 'Restricted Archives',
        },
      ],
    });

    speechBubbleRenderer.renderThought({
      entityId: 'npc-with-meta',
      thoughts: 'Separate channel',
      notes: [
        {
          text: 'Secure storage ready',
          subject: 'Reminder',
          context: 'Vault',
        },
      ],
    });

    const [speechMeta, thoughtMeta] = document.querySelectorAll('.speech-meta');
    const listButtonTypes = (container) =>
      Array.from(container.querySelectorAll('.meta-btn')).map((btn) => {
        if (btn.classList.contains('thoughts')) return 'thoughts';
        if (btn.classList.contains('notes')) return 'notes';
        if (btn.classList.contains('copy-all')) return 'copy-all';
        return 'other';
      });

    expect(listButtonTypes(speechMeta)).toEqual([
      'thoughts',
      'notes',
      'copy-all',
    ]);
    expect(listButtonTypes(thoughtMeta)).toEqual(['notes', 'copy-all']);

    copyToClipboard.mockClear();
    speechMeta
      .querySelector('.meta-btn.copy-all')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      `Archivist's thoughts:\nNeed to log this\n\nArchivist says: "Observe the relic"\n\nArchivist Log: Recovered fragment catalogued.\n  (Context: Restricted Archives)`
    );

    copyToClipboard.mockClear();
    thoughtMeta
      .querySelector('.meta-btn.copy-all')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      `Archivist's thoughts:\nSeparate channel\n\nReminder: Secure storage ready\n  (Context: Vault)`
    );
  });

  it('renders complex speech, handles HTML variations, and gracefully reacts to missing portraits and entities', () => {
    registerEntity({
      id: 'npc-without-portrait',
      definitionId: 'core:npc',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Archivist' },
      },
    });

    registerEntity({
      id: 'npc-with-portrait',
      definitionId: 'core:artist',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Painter' },
        [PORTRAIT_COMPONENT_ID]: {
          imagePath: 'portraits/painter.png',
          altText: 'Portrait of the painter',
        },
      },
    });

    const speechBubbleRenderer = new SpeechBubbleRenderer(baseDependencies);

    const scrollSpy = jest.spyOn(speechBubbleRenderer, 'scrollToBottom');

    speechBubbleRenderer.renderSpeech({
      entityId: 'npc-without-portrait',
      speechContent: 'Look at *carefully studies* <strong>the artifact</strong>.',
      allowHtml: true,
      thoughts: 'I hope they do not notice me writing this.',
      notes: [
        {
          text: 'Recovered fragment catalogued.',
          subject: 'Archivist Log',
          context: 'Restricted Archives',
        },
      ],
    });

    const firstEntry = document.querySelector('.speech-entry');
    expect(firstEntry).not.toBeNull();
    expect(firstEntry.classList.contains('no-portrait')).toBe(true);

    const quotedSpeech = firstEntry.querySelector('.speech-quoted-text');
    expect(quotedSpeech?.textContent?.startsWith('"')).toBe(true);
    expect(quotedSpeech?.textContent?.endsWith('"')).toBe(true);
    const actionSpan = firstEntry.querySelector('.speech-action-text');
    expect(actionSpan?.textContent).toBe('*carefully studies*');
    const strongElement = firstEntry.querySelector('.speech-quoted-text strong');
    expect(strongElement?.textContent).toBe('the artifact');

    const metaContainer = firstEntry.querySelector('.speech-meta');
    expect(metaContainer).not.toBeNull();
    expect(firstEntry.querySelector('.speech-bubble')?.classList.contains('has-meta')).toBe(true);

    expect(scrollSpy).toHaveBeenCalled();

    speechBubbleRenderer.renderSpeech({
      entityId: 'npc-without-portrait',
      speechContent: undefined,
      allowHtml: true,
    });

    const entriesAfterHtmlFallback = document.querySelectorAll('.speech-entry');
    expect(entriesAfterHtmlFallback).toHaveLength(2);

    const originalImgFactory = domElementFactory.img;
    domElementFactory.img = jest.fn().mockReturnValue(null);

    speechBubbleRenderer.renderSpeech({
      entityId: 'npc-with-portrait',
      speechContent: 'The pigments refuse to blend today.',
    });

    const portraitFailureEntry = document.querySelectorAll('.speech-entry')[2];
    expect(portraitFailureEntry.classList.contains('no-portrait')).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create portraitImg element.')
    );

    domElementFactory.img = originalImgFactory;

    speechBubbleRenderer.renderSpeech({
      entityId: 'unknown-speaker',
      speechContent: 'Is anyone listening?',
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Speaker entity with ID 'unknown-speaker' not found for player check.")
    );

    speechBubbleRenderer.dispose();
  });

  it('makes portraits interactive, falls back to event dispatch, and manages load/error flows', async () => {
    registerEntity({
      id: 'portrait-speaker',
      definitionId: 'core:scholar',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Scholar' },
        [PORTRAIT_COMPONENT_ID]: {
          imagePath: 'portraits/scholar.png',
          altText: 'Scholar portrait',
        },
      },
    });

    const portraitModalRenderer = {
      showModal: jest.fn(() => {
        throw new Error('modal failure');
      }),
      hideModal: jest.fn(),
    };

    const speechBubbleRenderer = new SpeechBubbleRenderer({
      ...baseDependencies,
      portraitModalRenderer,
    });

    const scrollSpy = jest.spyOn(speechBubbleRenderer, 'scrollToBottom');

    speechBubbleRenderer.renderSpeech({
      entityId: 'portrait-speaker',
      speechContent: 'Observe this manuscript.',
    });

    const portraitImg = document.querySelector('.speech-entry.has-portrait img');
    expect(portraitImg).not.toBeNull();
    expect(portraitImg?.getAttribute('aria-label')).toBe(
      'View full portrait of Scholar'
    );
    expect(portraitImg?.style.cursor).toBe('pointer');

    portraitImg?.dispatchEvent(new Event('load'));
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    const clickSpy = jest.spyOn(portraitImg, 'click');
    portraitImg?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clickSpy).toHaveBeenCalled();

    const clickEvent = new Event('click', { bubbles: true });
    portraitImg?.dispatchEvent(clickEvent);

    expect(portraitModalRenderer.showModal).toHaveBeenCalledWith(
      '/data/mods/core/portraits/scholar.png',
      'Scholar',
      portraitImg
    );
    expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith({
      type: PORTRAIT_CLICKED,
      payload: {
        portraitPath: '/data/mods/core/portraits/scholar.png',
        speakerName: 'Scholar',
        originalElement: portraitImg,
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to show portrait modal directly'),
      expect.any(Error)
    );

    portraitImg?.dispatchEvent(new Event('error'));
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Portrait image failed to load for Scholar.')
    );

    speechBubbleRenderer.dispose();
    await Promise.resolve();
  });

  it('renders thoughts with player detection, metadata, and cleanup', () => {
    registerEntity({
      id: 'player-entity',
      definitionId: 'core:player',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Player Character' },
        [PORTRAIT_COMPONENT_ID]: {
          imagePath: 'portraits/player.png',
          altText: 'Player portrait',
        },
        [PLAYER_TYPE_COMPONENT_ID]: { type: 'human' },
        [PLAYER_COMPONENT_ID]: { active: true },
      },
    });

    const speechBubbleRenderer = new SpeechBubbleRenderer(baseDependencies);
    const scrollSpy = jest.spyOn(speechBubbleRenderer, 'scrollToBottom');

    speechBubbleRenderer.renderThought({
      entityId: 'player-entity',
      thoughts: 'Stay calm and observe.',
      notes: [
        {
          text: 'Remember to check the hidden compartment.',
          subject: 'Reminder',
          context: 'Captain\'s Quarters',
        },
      ],
    });

    const thoughtEntry = document.querySelector('.thought-entry');
    expect(thoughtEntry).not.toBeNull();
    expect(thoughtEntry?.classList.contains('player-thought')).toBe(true);

    const intro = thoughtEntry?.querySelector('.thought-speaker-intro');
    expect(intro?.textContent).toBe('Player Character thinks: ');

    const content = thoughtEntry?.querySelector('.thought-content');
    expect(content?.textContent).toBe('Stay calm and observe.');

    const meta = thoughtEntry?.querySelector('.speech-meta');
    expect(meta).not.toBeNull();
    expect(thoughtEntry?.querySelector('.thought-bubble')?.classList.contains('has-meta')).toBe(true);

    expect(scrollSpy).not.toHaveBeenCalled();

    speechBubbleRenderer.dispose();
    expect(speechBubbleRenderer.effectiveSpeechContainer).toBeNull();
  });
});
