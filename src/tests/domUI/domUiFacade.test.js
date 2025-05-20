// src/tests/domUI/DomUiFacade.test.js
/**
 * @fileoverview Unit tests for the DomUiFacade class.
 */
import {DomUiFacade} from '../../domUI/index.js'; // Adjusted path to point to index.js
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// Mock the renderer/controller classes
// We only need to mock the methods checked in the facade constructor
const mockActionButtonsRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockInventoryPanel = {toggle: jest.fn(), dispose: jest.fn()};
const mockLocationRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockTitleRenderer = {set: jest.fn(), dispose: jest.fn()};
const mockInputStateController = {setEnabled: jest.fn(), dispose: jest.fn()};
const mockUiMessageRenderer = {render: jest.fn(), dispose: jest.fn()};
const mockPerceptionLogRenderer = {render: jest.fn(), dispose: jest.fn()}; // <<< ADDED MOCK

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
            perceptionLogRenderer: mockPerceptionLogRenderer, // <<< ADDED TO VALID DEPS
        };
    });

    // --- Constructor Tests ---

    it('should create an instance successfully with valid dependencies', () => {
        expect(() => new DomUiFacade(validDeps)).not.toThrow();
    });

    it('should throw an error if actionButtonsRenderer is missing', () => {
        const deps = {...validDeps}; // Create a copy to modify
        delete deps.actionButtonsRenderer;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid actionButtonsRenderer dependency.');
    });

    it('should throw an error if inventoryPanel is missing', () => {
        const deps = {...validDeps};
        delete deps.inventoryPanel;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid inventoryPanel dependency.');
    });

    it('should throw an error if locationRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.locationRenderer;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid locationRenderer dependency.');
    });

    it('should throw an error if titleRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.titleRenderer;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid titleRenderer dependency.');
    });

    it('should throw an error if inputStateController is missing', () => {
        const deps = {...validDeps};
        delete deps.inputStateController;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid inputStateController dependency.');
    });

    it('should throw an error if uiMessageRenderer is missing', () => {
        const deps = {...validDeps};
        delete deps.uiMessageRenderer;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid uiMessageRenderer dependency.');
    });

    it('should throw an error if perceptionLogRenderer is missing', () => { // <<< ADDED TEST
        const deps = {...validDeps};
        delete deps.perceptionLogRenderer;
        expect(() => new DomUiFacade(deps)).toThrow('DomUiFacade: Missing or invalid perceptionLogRenderer dependency.');
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

    it('should provide a getter for perceptionLog', () => { // <<< ADDED TEST
        const facade = new DomUiFacade(validDeps);
        expect(facade.perceptionLog).toBe(mockPerceptionLogRenderer);
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
        expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1); // <<< ADDED CHECK
    });

    it('should not throw if a renderer lacks a dispose method', () => {
        const incompleteDeps = {
            ...validDeps,
            actionButtonsRenderer: {render: jest.fn()} // No dispose
        };
        // Ensure perceptionLogRenderer is still present in incompleteDeps if it's part of validDeps now
        if (!incompleteDeps.perceptionLogRenderer) {
            incompleteDeps.perceptionLogRenderer = mockPerceptionLogRenderer;
        }


        const facade = new DomUiFacade(incompleteDeps);
        expect(() => facade.dispose()).not.toThrow();
        // Check others were still called
        expect(mockInventoryPanel.dispose).toHaveBeenCalledTimes(1);
        expect(mockPerceptionLogRenderer.dispose).toHaveBeenCalledTimes(1); // <<< ADDED CHECK
    });
});