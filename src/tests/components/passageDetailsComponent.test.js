// src/components/passageDetailsComponent.test.js

import { PassageDetailsComponent } from '../../components/passageDetailsComponent.js';
import {beforeEach, describe, expect, it} from "@jest/globals";

describe('PassageDetailsComponent', () => {
    let componentData;
    let component;

    beforeEach(() => {
        // Full data set for most tests
        componentData = {
            locationAId: 'test:room_a',
            locationBId: 'test:room_b',
            directionAtoB: 'north',
            directionBtoA: 'south',
            blockerEntityId: 'test:door_1',
            type: 'doorway',
            isHidden: true,
            state: 'closed',
            descriptionOverrideAtoB: 'A sturdy oak door leads north.',
            descriptionOverrideBtoA: 'You see the way back south through the doorway.',
        };
        component = new PassageDetailsComponent(componentData);
    });

    // --- Constructor Tests ---
    it('AC2: should initialize all properties correctly from provided data', () => {
        expect(component.locationAId).toBe('test:room_a');
        expect(component.locationBId).toBe('test:room_b');
        expect(component.directionAtoB).toBe('north');
        expect(component.directionBtoA).toBe('south');
        expect(component.blockerEntityId).toBe('test:door_1');
        expect(component.type).toBe('doorway');
        expect(component.state).toBe('closed');
        expect(component.descriptionOverrideAtoB).toBe('A sturdy oak door leads north.');
        expect(component.descriptionOverrideBtoA).toBe('You see the way back south through the doorway.');
    });

    it('AC2: should use default values for optional properties when not provided', () => {
        const minimalData = {
            locationAId: 'test:min_a',
            locationBId: 'test:min_b',
            directionAtoB: 'east',
            directionBtoA: 'west',
        };
        const minimalComponent = new PassageDetailsComponent(minimalData);

        expect(minimalComponent.blockerEntityId).toBeNull(); // Default
        expect(minimalComponent.type).toBe('passage');     // Default
        expect(minimalComponent.state).toBeUndefined();
        expect(minimalComponent.descriptionOverrideAtoB).toBeUndefined();
        expect(minimalComponent.descriptionOverrideBtoA).toBeUndefined();
    });

    it('AC2: should throw an error if required fields are missing', () => {
        expect(() => new PassageDetailsComponent({ locationAId: 'a', locationBId: 'b', directionAtoB: 'n' }))
            .toThrow("PassageDetailsComponent requires locationAId, locationBId, directionAtoB, and directionBtoA.");
    });

    // --- Getter Tests (AC3) ---
    it('getLocations() should return both location IDs', () => {
        expect(component.getLocations()).toEqual(['test:room_a', 'test:room_b']);
    });

    it('getOtherLocationId() should return the correct opposite location ID', () => {
        expect(component.getOtherLocationId('test:room_a')).toBe('test:room_b');
        expect(component.getOtherLocationId('test:room_b')).toBe('test:room_a');
    });

    it('getOtherLocationId() should throw error for invalid input', () => {
        expect(() => component.getOtherLocationId('test:room_c')).toThrow(
            "Location ID 'test:room_c' is not part of this passage (test:room_a <-> test:room_b)."
        );
    });

    it('getDirectionFrom() should return the correct direction from a location', () => {
        expect(component.getDirectionFrom('test:room_a')).toBe('north');
        expect(component.getDirectionFrom('test:room_b')).toBe('south');
    });

    it('getDirectionFrom() should throw error for invalid input', () => {
        expect(() => component.getDirectionFrom('test:room_c')).toThrow(
            "Location ID 'test:room_c' is not part of this passage (test:room_a <-> test:room_b)."
        );
    });

    it('getDirectionTo() should return the correct direction to a target location', () => {
        expect(component.getDirectionTo('test:room_b')).toBe('north'); // To get TO B, you go North (from A)
        expect(component.getDirectionTo('test:room_a')).toBe('south'); // To get TO A, you go South (from B)
    });

    it('getDirectionTo() should throw error for invalid input', () => {
        expect(() => component.getDirectionTo('test:room_c')).toThrow(
            "Target location ID 'test:room_c' is not part of this passage (test:room_a <-> test:room_b)."
        );
    });

    it('getBlockerId() should return the blocker ID or null', () => {
        expect(component.getBlockerId()).toBe('test:door_1');

        const minimalData = { locationAId: 'a', locationBId: 'b', directionAtoB: 'n', directionBtoA: 's'};
        const noBlockerComponent = new PassageDetailsComponent(minimalData);
        expect(noBlockerComponent.getBlockerId()).toBeNull();
    });

    it('getType() should return the passage type', () => {
        expect(component.getType()).toBe('doorway');
    });

    it('getState() should return the passage state or undefined', () => {
        expect(component.getState()).toBe('closed');

        const minimalData = { locationAId: 'a', locationBId: 'b', directionAtoB: 'n', directionBtoA: 's'};
        const noStateComponent = new PassageDetailsComponent(minimalData);
        expect(noStateComponent.getState()).toBeUndefined();
    });

    it('isHidden() should return the hidden status', () => {
        expect(component.isHidden()).toBe(true);

        const minimalData = { locationAId: 'a', locationBId: 'b', directionAtoB: 'n', directionBtoA: 's'};
        const notHiddenComponent = new PassageDetailsComponent(minimalData);
        expect(notHiddenComponent.isHidden()).toBe(false);
    });

    it('getDescriptionFrom() should return the correct description override', () => {
        expect(component.getDescriptionFrom('test:room_a')).toBe('A sturdy oak door leads north.');
        expect(component.getDescriptionFrom('test:room_b')).toBe('You see the way back south through the doorway.');

        const minimalData = { locationAId: 'a', locationBId: 'b', directionAtoB: 'n', directionBtoA: 's'};
        const noDescComponent = new PassageDetailsComponent(minimalData);
        expect(noDescComponent.getDescriptionFrom('a')).toBeUndefined();
        expect(noDescComponent.getDescriptionFrom('b')).toBeUndefined();
    });

    it('getDescriptionFrom() should throw error for invalid input', () => {
        expect(() => component.getDescriptionFrom('test:room_c')).toThrow(
            "Location ID 'test:room_c' is not part of this passage (test:room_a <-> test:room_b)."
        );
    });
});