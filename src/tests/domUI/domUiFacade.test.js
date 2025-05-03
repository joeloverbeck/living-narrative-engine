// src/domUI/DomUiFacade.test.js
/**
 * @fileoverview Unit tests for the DomUiFacade class.
 */
import {DomUiFacade} from '../../domUI/index.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// Mock the renderer/controller classes
// We only need to mock the methods checked in the facade constructor
const mockActionButtonsRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockInventoryPanel = {toggle: jest.fn(), dispose: jest.fn()};
const mockLocationRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockTitleRenderer = {set: jest.fn(), dispose: jest.fn()};
const mockInputStateController = {setEnabled: jest.fn(), dispose: jest.fn()};
const mockUiMessageRenderer = {render: jest.fn(), dispose: jest.fn()};

describe('DomUiFacade', () => {
    let validDeps;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Set up valid dependencies
        validDeps = {
            actionButtonsRenderer: mockActionButtonsRenderer,
            inventoryPanel: mockInventoryPanel,
            locationRenderer: mockLocationRenderer,
            titleRenderer: mockTitleRenderer,
            inputStateController: mockInputStateController,
            uiMessageRenderer: mockUiMessageRenderer,
        };
    });

    // --- Constructor Tests ---

    it('should create an instance successfully with valid dependencies', () => {
        expect(() => new DomUiFacade(validDeps)).not.toThrow();
    });

    it('should throw an error if actionButtonsRenderer is missing', () => {
        delete validDeps.actionButtonsRenderer;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid actionButtonsRenderer dependency.');
    });

    it('should throw an error if inventoryPanel is missing', () => {
        delete validDeps.inventoryPanel;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid inventoryPanel dependency.');
    });

    it('should throw an error if locationRenderer is missing', () => {
        delete validDeps.locationRenderer;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid locationRenderer dependency.');
    });

    it('should throw an error if titleRenderer is missing', () => {
        delete validDeps.titleRenderer;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid titleRenderer dependency.');
    });

    it('should throw an error if inputStateController is missing', () => {
        delete validDeps.inputStateController;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid inputStateController dependency.');
    });

    it('should throw an error if uiMessageRenderer is missing', () => {
        delete validDeps.uiMessageRenderer;
        expect(() => new DomUiFacade(validDeps)).toThrow('DomUiFacade: Missing or invalid uiMessageRenderer dependency.');
    });

    // --- Getter Tests (Acceptance Criteria) ---

    it('should provide a getter for actionButtonsRenderer', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.actionButtons).toBe(mockActionButtonsRenderer);
    });

    it('should provide a getter for inventoryPanel', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.inventory).toBe(mockInventoryPanel);
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

    it('should provide a getter for uiMessageRenderer', () => {
        const facade = new DomUiFacade(validDeps);
        expect(facade.messages).toBe(mockUiMessageRenderer);
    });

    // --- Dispose Test ---

    it('should call dispose on all underlying renderers if they have a dispose method', () => {
        const facade = new DomUiFacade(validDeps);
        facade.dispose();

        expect(mockActionButtonsRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockInventoryPanel.dispose).toHaveBeenCalledTimes(1);
        expect(mockLocationRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockTitleRenderer.dispose).toHaveBeenCalledTimes(1);
        expect(mockInputStateController.dispose).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.dispose).toHaveBeenCalledTimes(1);
    });

    it('should not throw if a renderer lacks a dispose method', () => {
        const incompleteDeps = {
            ...validDeps,
            actionButtonsRenderer: {render: jest.fn()} // No dispose
        };
        const facade = new DomUiFacade(incompleteDeps);
        expect(() => facade.dispose()).not.toThrow();
        // Check others were still called
        expect(mockInventoryPanel.dispose).toHaveBeenCalledTimes(1);
    });
});