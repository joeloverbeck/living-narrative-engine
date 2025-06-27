import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ProcessingIndicatorController, DomElementFactory } from '../../../src/domUI';
import {
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
  TURN_STARTED_ID,
} from '../../../src/constants/eventIds.js';

describe('ProcessingIndicatorController - Player Type Detection', () => {
  let controller;
  let ved;
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM(`<!DOCTYPE html>
      <div id="outputDiv">
        <div id="message-list"></div>
      </div>
      <input type="text" id="speech-input" />
    `);
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Setup mocks
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    ved = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };

    const docContext = {
      query: (sel) => document.querySelector(sel),
      create: (tag) => document.createElement(tag),
      document,
    };

    const domElementFactory = new DomElementFactory(docContext);

    controller = new ProcessingIndicatorController({
      logger,
      documentContext: docContext,
      safeEventDispatcher: ved,
      domElementFactory,
    });
  });

  afterEach(() => {
    controller.dispose();
    jest.restoreAllMocks();
    if (window) window.close();
    global.window = undefined;
    global.document = undefined;
  });

  // Helper to get handler for specific event
  const getHandler = (eventId) =>
    ved.subscribe.mock.calls.find((c) => c[0] === eventId)?.[1];

  describe('Player type detection from turn_started event', () => {
    it('should correctly identify human player from player_type component', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // Simulate turn_started event for human player
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'player1',
          entityType: 'player',
          entity: {
            id: 'player1',
            components: {
              'core:player_type': { type: 'human' }
            }
          }
        }
      });

      // Human turn should not show indicator on TURN_PROCESSING_STARTED
      const processingStartedHandler = getHandler(TURN_PROCESSING_STARTED);
      processingStartedHandler();
      
      expect(indicator?.classList.contains('visible')).toBe(false);
    });

    it('should correctly identify LLM AI player from player_type component', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // Simulate turn_started event for LLM AI
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'ai1',
          entityType: 'ai',
          entity: {
            id: 'ai1',
            components: {
              'core:player_type': { type: 'llm' }
            }
          }
        }
      });

      // AI turn should show indicator on TURN_PROCESSING_STARTED
      const processingStartedHandler = getHandler(TURN_PROCESSING_STARTED);
      processingStartedHandler();
      
      expect(indicator?.classList.contains('visible')).toBe(true);
      expect(indicator?.classList.contains('ai-llm')).toBe(true);
    });

    it('should correctly identify GOAP AI player from player_type component', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // Simulate turn_started event for GOAP AI
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'goap1',
          entityType: 'ai',
          entity: {
            id: 'goap1',
            components: {
              'core:player_type': { type: 'goap' }
            }
          }
        }
      });

      // AI turn should show indicator on TURN_PROCESSING_STARTED
      const processingStartedHandler = getHandler(TURN_PROCESSING_STARTED);
      processingStartedHandler();
      
      expect(indicator?.classList.contains('visible')).toBe(true);
      expect(indicator?.classList.contains('ai-goap')).toBe(true);
    });

    it('should fall back to entityType when entity object is missing', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // Simulate turn_started event without entity object (legacy format)
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'player1',
          entityType: 'player'
        }
      });

      // Should treat as human based on entityType
      const processingStartedHandler = getHandler(TURN_PROCESSING_STARTED);
      processingStartedHandler();
      
      expect(indicator?.classList.contains('visible')).toBe(false);
    });

    it('should default to ai-llm when no player type info available', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // Simulate turn_started event for AI without player_type
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'ai1',
          entityType: 'ai',
          entity: {
            id: 'ai1',
            components: {}
          }
        }
      });

      // Should default to ai-llm
      const processingStartedHandler = getHandler(TURN_PROCESSING_STARTED);
      processingStartedHandler();
      
      expect(indicator?.classList.contains('visible')).toBe(true);
      expect(indicator?.classList.contains('ai-llm')).toBe(true);
    });
  });

  describe('Focus-based indicator for human players', () => {
    it('should show indicator on focus for human players', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // First set up human turn
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'player1',
          entityType: 'player',
          entity: {
            id: 'player1',
            components: {
              'core:player_type': { type: 'human' }
            }
          }
        }
      });

      // Simulate focus event
      const focusHandler = getHandler('core:speech_input_gained_focus');
      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() }
      });

      expect(indicator?.classList.contains('visible')).toBe(true);
      expect(indicator?.classList.contains('human')).toBe(true);
    });

    it('should not show indicator on focus for AI players', () => {
      const indicator = document.querySelector('#processing-indicator');
      
      // First set up AI turn
      const turnStartedHandler = getHandler(TURN_STARTED_ID);
      turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: {
          entityId: 'ai1',
          entityType: 'ai',
          entity: {
            id: 'ai1',
            components: {
              'core:player_type': { type: 'llm' }
            }
          }
        }
      });

      // Simulate focus event - should not show for AI
      const focusHandler = getHandler('core:speech_input_gained_focus');
      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() }
      });

      expect(indicator?.classList.contains('visible')).toBe(false);
    });
  });
});