// tests/domUI/domUiFacade.test.js

/**
 * @fileoverview Unit tests for the DomUiFacade class.
 */

import {DomUiFacade} from '../../src/domUI/index.js';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';

/* -------- mock components -------- */
const mockActionButtonsRenderer = {render: jest.fn(), dispose: jest.fn()};
// Removed mockInventoryPanel as it's no longer a dependency
const mockLocationRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockTitleRenderer = {set: jest.fn(), dispose: jest.fn()};
const mockInputStateController = {setEnabled: jest.fn(), dispose: jest.fn()};
const mockUiMessageRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockPerceptionLogRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockSaveGameUI = {show: jest.fn(), dispose: jest.fn()};
const mockLoadGameUI = {show: jest.fn(), dispose: jest.fn()};
const mockLlmSelectionModal = {show: jest.fn(), dispose: jest.fn()};

describe('DomUiFacade', () => {
    let validDeps;

    beforeEach(() => {
        jest.clearAllMocks();

        validDeps = {
            actionButtonsRenderer: mockActionButtonsRenderer,
            // inventoryPanel: mockInventoryPanel, // Removed
            locationRenderer: mockLocationRenderer,
            titleRenderer: mockTitleRenderer,
            inputStateController: mockInputStateController,
            uiMessageRenderer: mockUiMessageRenderer,
            perceptionLogRenderer: mockPerceptionLogRenderer,
            saveGameUI: mockSaveGameUI,
            loadGameUI: mockLoadGameUI,
            llmSelectionModal: mockLlmSelectionModal,
        };
    });

    /* ---------- constructor happy-path ---------- */
    it('should create an instance successfully with valid dependencies', () => {
        expect(() => new DomUiFacade(validDeps)).not.toThrow();
    });

    /* ---------- constructor guard clauses ---------- */
    it('should throw an error if actionButtonsRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.actionButtonsRenderer;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid actionButtonsRenderer dependency.');
    });

    // Removed test: 'should throw an error if inventoryPanel is missing'

    it('should throw an error if locationRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.locationRenderer;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid locationRenderer dependency.');
    });

    it('should throw an error if titleRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.titleRenderer;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid titleRenderer dependency.');
    });

    it('should throw an error if inputStateController is missing', () => {
        const deps = {...validDeps};
        delete deps.inputStateController;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid inputStateController dependency.');
    });

    it('should throw an error if uiMessageRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.uiMessageRenderer;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid uiMessageRenderer dependency.');
    });

    it('should throw an error if perceptionLogRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.perceptionLogRenderer;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid perceptionLogRenderer dependency.');
    });

    it('should throw an error if saveGameUI is missing', () => {
        const deps = {...validDeps};
        delete deps.saveGameUI;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid saveGameUI dependency.');
    });

    it('should throw an error if loadGameUI is missing', () => {
        const deps = {...validDeps};
        delete deps.loadGameUI;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid loadGameUI dependency.');
    });

    it('should throw an error if llmSelectionModal is missing', () => {
        const deps = {...validDeps};
        delete deps.llmSelectionModal;
        expect(() => new DomUiFacade(deps))
            .toThrow('DomUiFacade: Missing or invalid llmSelectionModal dependency.');
    });

    /* ---------- getters ---------- */
    it('should provide a getter for actionButtonsRenderer', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.actionButtons).toBe(mockActionButtonsRenderer);
    });

    // Removed test: 'should provide a getter for inventoryPanel'

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

    it('should provide a getter for uiMessageRenderer', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.messages).toBe(mockUiMessageRenderer);
    });

    it('should provide a getter for perceptionLog', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.perceptionLog).toBe(mockPerceptionLogRenderer);
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

    /* ---------- dispose ---------- */
    it('should call dispose on all underlying renderers if they have a dispose method', () => {
        const facade = new DomUiFacade(validDeps);
        facade.dispose();

        expect(mockActionButtonsRenderer.dispose).toHaveBeenCalledTimes(1);
        // expect(mockInventoryPanel.dispose).toHaveBeenCalledTimes(1); // Removed
        expect(mockLocationRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockTitleRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockInputStateController.dispose).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockSaveGameUI.dispose).toHaveBeenCalledTimes(1);
        expect(mockLoadGameUI.dispose).toHaveBeenCalledTimes(1);
        expect(mockLlmSelectionModal.dispose).toHaveBeenCalledTimes(1);
    });

    it('should not throw if a renderer lacks a dispose method', () => {
        const incompleteDeps = {
            ...validDeps,
            actionButtonsRenderer: {render: jest.fn()}, // no dispose
            saveGameUI: {show: jest.fn()},   // no dispose
        };
        // mockInventoryPanel is already removed from validDeps, so no need to mock it here specifically for this test

        const facade = new DomUiFacade(incompleteDeps);
        expect(() => facade.dispose()).not.toThrow();

        // Check dispose for other mocks that do have it and are included in incompleteDeps
        expect(mockLocationRenderer.dispose).toHaveBeenCalledTimes(1); // Example, assuming it's in incompleteDeps via ...validDeps
        expect(mockTitleRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockInputStateController.dispose).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.dispose).toHaveBeenCalledTimes(1);
        // expect(mockInventoryPanel.dispose).toHaveBeenCalledTimes(1); // Removed
        expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockLoadGameUI.dispose).toHaveBeenCalledTimes(1);
        expect(mockLlmSelectionModal.dispose).toHaveBeenCalledTimes(1);

        // Verify that the mocks without dispose were not attempted to be called (implicitly)
        // Jest's toHaveBeenCalledTimes(0) could be used if we had a spy on a potentially undefined property
        // but the optional chaining `?.dispose?.()` handles this gracefully.
    });
});