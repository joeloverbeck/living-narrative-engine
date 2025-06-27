// tests/domUI/domUiFacade.test.js

/**
 * @file Unit tests for the DomUiFacade class.
 */

import { DomUiFacade } from '../../../src/domUI';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/* -------- mock components -------- */
// Updated mocks to provide refreshList instead of render where appropriate
const mockActionButtonsRenderer = {
  refreshList: jest.fn(),
  dispose: jest.fn(),
};
const mockLocationRenderer = { render: jest.fn(), dispose: jest.fn() };
const mockTitleRenderer = { set: jest.fn(), dispose: jest.fn() };
const mockInputStateController = { setEnabled: jest.fn(), dispose: jest.fn() };
const mockSpeechBubbleRenderer = {
  renderSpeech: jest.fn(),
  dispose: jest.fn(),
};
const mockPerceptionLogRenderer = {
  refreshList: jest.fn(),
  dispose: jest.fn(),
};
const mockActionResultRenderer = { dispose: jest.fn() }; // Added mock for actionResultRenderer
const mockSaveGameUI = { show: jest.fn(), dispose: jest.fn() };
const mockLoadGameUI = { show: jest.fn(), dispose: jest.fn() };
const mockLlmSelectionModal = { show: jest.fn(), dispose: jest.fn() };
const mockEntityLifecycleMonitor = {
  clearEvents: jest.fn(),
  dispose: jest.fn(),
};

describe('DomUiFacade', () => {
  let validDeps;

  beforeEach(() => {
    jest.clearAllMocks();

    validDeps = {
      actionButtonsRenderer: mockActionButtonsRenderer,
      locationRenderer: mockLocationRenderer,
      titleRenderer: mockTitleRenderer,
      inputStateController: mockInputStateController,
      speechBubbleRenderer: mockSpeechBubbleRenderer,
      perceptionLogRenderer: mockPerceptionLogRenderer,
      actionResultRenderer: mockActionResultRenderer, // Added dependency
      saveGameUI: mockSaveGameUI,
      loadGameUI: mockLoadGameUI,
      llmSelectionModal: mockLlmSelectionModal,
      entityLifecycleMonitor: mockEntityLifecycleMonitor,
    };
  });

  /* ---------- constructor happy-path ---------- */
  it('should create an instance successfully with valid dependencies', () => {
    expect(() => new DomUiFacade(validDeps)).not.toThrow();
  });

  /* ---------- constructor guard clauses ---------- */
  it('should throw an error if actionButtonsRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.actionButtonsRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid actionButtonsRenderer dependency.'
    );
  });

  it('should throw an error if locationRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.locationRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid locationRenderer dependency.'
    );
  });

  it('should throw an error if titleRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.titleRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid titleRenderer dependency.'
    );
  });

  it('should throw an error if inputStateController is missing', () => {
    const deps = { ...validDeps };
    delete deps.inputStateController;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid inputStateController dependency.'
    );
  });

  it('should throw an error if speechBubbleRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.speechBubbleRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid speechBubbleRenderer dependency.'
    );
  });

  it('should throw an error if perceptionLogRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.perceptionLogRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid perceptionLogRenderer dependency.'
    );
  });

  // Added test for actionResultRenderer
  it('should throw an error if actionResultRenderer is missing', () => {
    const deps = { ...validDeps };
    delete deps.actionResultRenderer;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid actionResultRenderer dependency.'
    );
  });

  it('should throw an error if saveGameUI is missing', () => {
    const deps = { ...validDeps };
    delete deps.saveGameUI;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid saveGameUI dependency.'
    );
  });

  it('should throw an error if loadGameUI is missing', () => {
    const deps = { ...validDeps };
    delete deps.loadGameUI;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid loadGameUI dependency.'
    );
  });

  it('should throw an error if llmSelectionModal is missing', () => {
    const deps = { ...validDeps };
    delete deps.llmSelectionModal;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid llmSelectionModal dependency.'
    );
  });

  it('should throw an error if entityLifecycleMonitor is missing', () => {
    const deps = { ...validDeps };
    delete deps.entityLifecycleMonitor;
    expect(() => new DomUiFacade(deps)).toThrow(
      'DomUiFacade: Missing or invalid entityLifecycleMonitor dependency.'
    );
  });

  /* ---------- getters ---------- */
  it('should provide a getter for actionButtonsRenderer', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.actionButtons).toBe(mockActionButtonsRenderer);
  });

  it('should provide a getter for locationRenderer', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.location).toBe(mockLocationRenderer);
  });

  it('should provide a getter for titleRenderer', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.title).toBe(mockTitleRenderer);
  });

  it('should provide a getter for inputStateController', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.input).toBe(mockInputStateController);
  });

  it('should provide a getter for speechBubbleRenderer', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.speechBubble).toBe(mockSpeechBubbleRenderer);
  });

  it('should provide a getter for perceptionLog', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.perceptionLog).toBe(mockPerceptionLogRenderer);
  });

  // Added getter test for actionResults
  it('should provide a getter for actionResults', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.actionResults).toBe(mockActionResultRenderer);
  });

  it('should provide a getter for saveGame', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.saveGame).toBe(mockSaveGameUI);
  });

  it('should provide a getter for loadGame', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.loadGame).toBe(mockLoadGameUI);
  });

  it('should provide a getter for llmSelectionModal', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.llmSelectionModal).toBe(mockLlmSelectionModal);
  });

  it('should provide a getter for entityLifecycleMonitor', () => {
    const facade = new DomUiFacade(validDeps);
    expect(facade.entityLifecycleMonitor).toBe(mockEntityLifecycleMonitor);
  });

  /* ---------- dispose ---------- */
  it('should call dispose on all underlying renderers if they have a dispose method', () => {
    const facade = new DomUiFacade(validDeps);
    facade.dispose();

    expect(mockActionButtonsRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockLocationRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockTitleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockInputStateController.dispose).toHaveBeenCalledTimes(1);
    expect(mockSpeechBubbleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockActionResultRenderer.dispose).toHaveBeenCalledTimes(1); // Added dispose check
    expect(mockSaveGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(mockLoadGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(mockLlmSelectionModal.dispose).toHaveBeenCalledTimes(1);
    expect(mockEntityLifecycleMonitor.dispose).toHaveBeenCalledTimes(1);
  });

  it('should not throw if a renderer lacks a dispose method', () => {
    const incompleteDeps = {
      ...validDeps,
      actionButtonsRenderer: { refreshList: jest.fn() }, // no dispose, but has refreshList
      speechBubbleRenderer: { renderSpeech: jest.fn() }, // no dispose
      actionResultRenderer: {}, // no dispose
      saveGameUI: { show: jest.fn() }, // no dispose
      entityLifecycleMonitor: { clearEvents: jest.fn() }, // no dispose
    };

    const facade = new DomUiFacade(incompleteDeps);
    expect(() => facade.dispose()).not.toThrow();

    // These should still be called
    expect(mockLocationRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockTitleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockInputStateController.dispose).toHaveBeenCalledTimes(1);
    expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(mockLoadGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(mockLlmSelectionModal.dispose).toHaveBeenCalledTimes(1);

    // And these should not have been called because they weren't provided.
    expect(mockActionButtonsRenderer.dispose).not.toHaveBeenCalled();
    expect(mockSpeechBubbleRenderer.dispose).not.toHaveBeenCalled();
    expect(mockSaveGameUI.dispose).not.toHaveBeenCalled();
    expect(mockEntityLifecycleMonitor.dispose).not.toHaveBeenCalled();
  });
});
