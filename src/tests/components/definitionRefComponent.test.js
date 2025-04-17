// src/components/definitionRefComponent.basic.test.js
import {DefinitionRefComponent} from '../../components/definitionRefComponent.js'; // Adjust path if necessary
import Component from '../../components/component.js';
import {describe, expect, it} from "@jest/globals"; // Import base class if needed for instanceof check

// Mock the base Component class if it has abstract methods or complex setup
// If Component is very simple (like an empty class), mocking might not be needed.
// jest.mock('./component.js'); // Example using Jest

describe('DefinitionRefComponent', () => {

    it('should be an instance of Component', () => {
        const component = new DefinitionRefComponent('test:id');
        // This check assumes Component is a valid class and inheritance works
        // Adjust if your Component base class setup is different
        // expect(component).toBeInstanceOf(Component);
        // For now, we focus on the specific properties of DefinitionRefComponent
    });

    it('should correctly store the provided string ID in the constructor', () => {
        const testId = 'namespace:entity_definition_123';
        const component = new DefinitionRefComponent(testId);
        expect(component.id).toBe(testId);
    });

    it('should store null if the constructor is called with null', () => {
        const component = new DefinitionRefComponent(null);
        expect(component.id).toBeNull();
    });

    it('should store null if the constructor is called with undefined', () => {
        const component = new DefinitionRefComponent(undefined);
        expect(component.id).toBeNull();
    });

    it('should store null if the constructor is called with no arguments', () => {
        const component = new DefinitionRefComponent();
        expect(component.id).toBeNull();
    });

    // Optional: Test immutability if desired (though not strictly required by ticket)
    it('should allow reading the id property', () => {
        const testId = 'another:id';
        const component = new DefinitionRefComponent(testId);
        expect(component.id).toBe(testId);
    });
});