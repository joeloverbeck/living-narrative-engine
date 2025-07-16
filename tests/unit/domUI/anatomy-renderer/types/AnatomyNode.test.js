/**
 * @file Unit tests for AnatomyNode
 * @description Comprehensive unit tests for AnatomyNode class covering all methods and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyNode from '../../../../../src/domUI/anatomy-renderer/types/AnatomyNode.js';

describe('AnatomyNode', () => {
  let anatomyNode;

  beforeEach(() => {
    anatomyNode = new AnatomyNode('test-id', 'Test Node', 'torso', 1);
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(anatomyNode.id).toBe('test-id');
      expect(anatomyNode.name).toBe('Test Node');
      expect(anatomyNode.type).toBe('torso');
      expect(anatomyNode.depth).toBe(1);
    });

    it('should initialize position coordinates to zero', () => {
      expect(anatomyNode.x).toBe(0);
      expect(anatomyNode.y).toBe(0);
    });

    it('should initialize dimensions to zero', () => {
      expect(anatomyNode.width).toBe(0);
      expect(anatomyNode.height).toBe(0);
    });

    it('should initialize radial layout properties', () => {
      expect(anatomyNode.angle).toBe(0);
      expect(anatomyNode.radius).toBe(0);
      expect(anatomyNode.angleStart).toBe(0);
      expect(anatomyNode.angleEnd).toBe(0);
      expect(anatomyNode.leafCount).toBe(1);
    });

    it('should initialize additional metadata', () => {
      expect(anatomyNode.description).toBe('');
      expect(anatomyNode.metadata).toEqual({});
    });

    it('should handle different node types', () => {
      const headNode = new AnatomyNode('head-id', 'Head', 'head', 0);
      const armNode = new AnatomyNode('arm-id', 'Left Arm', 'arm', 2);
      const legNode = new AnatomyNode('leg-id', 'Right Leg', 'leg', 2);

      expect(headNode.type).toBe('head');
      expect(armNode.type).toBe('arm');
      expect(legNode.type).toBe('leg');
    });

    it('should handle different depths', () => {
      const rootNode = new AnatomyNode('root', 'Root', 'torso', 0);
      const deepNode = new AnatomyNode('deep', 'Deep', 'hand', 5);

      expect(rootNode.depth).toBe(0);
      expect(deepNode.depth).toBe(5);
    });

    it('should handle special characters in name', () => {
      const specialNode = new AnatomyNode('special', 'Left Hand (Palm)', 'hand', 3);

      expect(specialNode.name).toBe('Left Hand (Palm)');
    });
  });

  describe('setPosition', () => {
    it('should set position coordinates', () => {
      anatomyNode.setPosition(100, 200);

      expect(anatomyNode.x).toBe(100);
      expect(anatomyNode.y).toBe(200);
    });

    it('should handle negative coordinates', () => {
      anatomyNode.setPosition(-50, -100);

      expect(anatomyNode.x).toBe(-50);
      expect(anatomyNode.y).toBe(-100);
    });

    it('should handle decimal coordinates', () => {
      anatomyNode.setPosition(10.5, 20.3);

      expect(anatomyNode.x).toBe(10.5);
      expect(anatomyNode.y).toBe(20.3);
    });

    it('should handle zero coordinates', () => {
      anatomyNode.setPosition(0, 0);

      expect(anatomyNode.x).toBe(0);
      expect(anatomyNode.y).toBe(0);
    });

    it('should overwrite previous position', () => {
      anatomyNode.setPosition(100, 200);
      anatomyNode.setPosition(300, 400);

      expect(anatomyNode.x).toBe(300);
      expect(anatomyNode.y).toBe(400);
    });
  });

  describe('setDimensions', () => {
    it('should set width and height', () => {
      anatomyNode.setDimensions(50, 80);

      expect(anatomyNode.width).toBe(50);
      expect(anatomyNode.height).toBe(80);
    });

    it('should handle zero dimensions', () => {
      anatomyNode.setDimensions(0, 0);

      expect(anatomyNode.width).toBe(0);
      expect(anatomyNode.height).toBe(0);
    });

    it('should handle decimal dimensions', () => {
      anatomyNode.setDimensions(25.5, 35.7);

      expect(anatomyNode.width).toBe(25.5);
      expect(anatomyNode.height).toBe(35.7);
    });

    it('should handle large dimensions', () => {
      anatomyNode.setDimensions(1000, 2000);

      expect(anatomyNode.width).toBe(1000);
      expect(anatomyNode.height).toBe(2000);
    });

    it('should overwrite previous dimensions', () => {
      anatomyNode.setDimensions(50, 80);
      anatomyNode.setDimensions(100, 150);

      expect(anatomyNode.width).toBe(100);
      expect(anatomyNode.height).toBe(150);
    });
  });

  describe('setRadialProperties', () => {
    it('should set all radial properties', () => {
      const radialProps = {
        angle: Math.PI / 4,
        radius: 100,
        angleStart: 0,
        angleEnd: Math.PI / 2,
      };

      anatomyNode.setRadialProperties(radialProps);

      expect(anatomyNode.angle).toBe(Math.PI / 4);
      expect(anatomyNode.radius).toBe(100);
      expect(anatomyNode.angleStart).toBe(0);
      expect(anatomyNode.angleEnd).toBe(Math.PI / 2);
    });

    it('should handle zero values', () => {
      const radialProps = {
        angle: 0,
        radius: 0,
        angleStart: 0,
        angleEnd: 0,
      };

      anatomyNode.setRadialProperties(radialProps);

      expect(anatomyNode.angle).toBe(0);
      expect(anatomyNode.radius).toBe(0);
      expect(anatomyNode.angleStart).toBe(0);
      expect(anatomyNode.angleEnd).toBe(0);
    });

    it('should handle negative angles', () => {
      const radialProps = {
        angle: -Math.PI / 4,
        radius: 50,
        angleStart: -Math.PI,
        angleEnd: Math.PI,
      };

      anatomyNode.setRadialProperties(radialProps);

      expect(anatomyNode.angle).toBe(-Math.PI / 4);
      expect(anatomyNode.radius).toBe(50);
      expect(anatomyNode.angleStart).toBe(-Math.PI);
      expect(anatomyNode.angleEnd).toBe(Math.PI);
    });

    it('should handle partial updates', () => {
      // Set initial values
      anatomyNode.setRadialProperties({
        angle: Math.PI,
        radius: 200,
        angleStart: 0,
        angleEnd: Math.PI,
      });

      // Update only some properties
      anatomyNode.setRadialProperties({
        angle: Math.PI / 2,
        radius: 150,
        angleStart: undefined,
        angleEnd: undefined,
      });

      expect(anatomyNode.angle).toBe(Math.PI / 2);
      expect(anatomyNode.radius).toBe(150);
      expect(anatomyNode.angleStart).toBe(undefined);
      expect(anatomyNode.angleEnd).toBe(undefined);
    });

    it('should overwrite previous radial properties', () => {
      anatomyNode.setRadialProperties({
        angle: Math.PI,
        radius: 100,
        angleStart: 0,
        angleEnd: Math.PI / 2,
      });

      anatomyNode.setRadialProperties({
        angle: Math.PI / 4,
        radius: 200,
        angleStart: Math.PI / 4,
        angleEnd: Math.PI,
      });

      expect(anatomyNode.angle).toBe(Math.PI / 4);
      expect(anatomyNode.radius).toBe(200);
      expect(anatomyNode.angleStart).toBe(Math.PI / 4);
      expect(anatomyNode.angleEnd).toBe(Math.PI);
    });
  });

  describe('getCenter', () => {
    it('should return center coordinates', () => {
      anatomyNode.setPosition(100, 200);

      const center = anatomyNode.getCenter();

      expect(center).toEqual({ x: 100, y: 200 });
    });

    it('should return center with zero coordinates', () => {
      const center = anatomyNode.getCenter();

      expect(center).toEqual({ x: 0, y: 0 });
    });

    it('should return center with negative coordinates', () => {
      anatomyNode.setPosition(-50, -100);

      const center = anatomyNode.getCenter();

      expect(center).toEqual({ x: -50, y: -100 });
    });

    it('should return center with decimal coordinates', () => {
      anatomyNode.setPosition(10.5, 20.3);

      const center = anatomyNode.getCenter();

      expect(center).toEqual({ x: 10.5, y: 20.3 });
    });

    it('should return new object each time', () => {
      anatomyNode.setPosition(100, 200);

      const center1 = anatomyNode.getCenter();
      const center2 = anatomyNode.getCenter();

      expect(center1).not.toBe(center2);
      expect(center1).toEqual(center2);
    });
  });

  describe('getBounds', () => {
    it('should calculate bounding box correctly', () => {
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(50, 80);

      const bounds = anatomyNode.getBounds();

      expect(bounds).toEqual({
        left: 75,    // 100 - 50/2
        top: 160,    // 200 - 80/2
        right: 125,  // 100 + 50/2
        bottom: 240, // 200 + 80/2
      });
    });

    it('should handle zero dimensions', () => {
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(0, 0);

      const bounds = anatomyNode.getBounds();

      expect(bounds).toEqual({
        left: 100,
        top: 200,
        right: 100,
        bottom: 200,
      });
    });

    it('should handle zero position', () => {
      anatomyNode.setPosition(0, 0);
      anatomyNode.setDimensions(100, 200);

      const bounds = anatomyNode.getBounds();

      expect(bounds).toEqual({
        left: -50,   // 0 - 100/2
        top: -100,   // 0 - 200/2
        right: 50,   // 0 + 100/2
        bottom: 100, // 0 + 200/2
      });
    });

    it('should handle negative position', () => {
      anatomyNode.setPosition(-50, -100);
      anatomyNode.setDimensions(30, 40);

      const bounds = anatomyNode.getBounds();

      expect(bounds).toEqual({
        left: -65,   // -50 - 30/2
        top: -120,   // -100 - 40/2
        right: -35,  // -50 + 30/2
        bottom: -80, // -100 + 40/2
      });
    });

    it('should handle decimal values', () => {
      anatomyNode.setPosition(10.5, 20.3);
      anatomyNode.setDimensions(5.2, 8.6);

      const bounds = anatomyNode.getBounds();

      expect(bounds.left).toBeCloseTo(7.9);    // 10.5 - 5.2/2
      expect(bounds.top).toBeCloseTo(16);      // 20.3 - 8.6/2
      expect(bounds.right).toBeCloseTo(13.1);  // 10.5 + 5.2/2
      expect(bounds.bottom).toBeCloseTo(24.6); // 20.3 + 8.6/2
    });

    it('should return new object each time', () => {
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(50, 80);

      const bounds1 = anatomyNode.getBounds();
      const bounds2 = anatomyNode.getBounds();

      expect(bounds1).not.toBe(bounds2);
      expect(bounds1).toEqual(bounds2);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the anatomy node', () => {
      // Set up the original node
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(50, 80);
      anatomyNode.setRadialProperties({
        angle: Math.PI / 4,
        radius: 150,
        angleStart: 0,
        angleEnd: Math.PI / 2,
      });
      anatomyNode.leafCount = 5;
      anatomyNode.description = 'Test description';
      anatomyNode.metadata = { color: 'red', size: 'large' };

      const clone = anatomyNode.clone();

      expect(clone).not.toBe(anatomyNode);
      expect(clone.metadata).not.toBe(anatomyNode.metadata);
    });

    it('should preserve all basic properties', () => {
      const clone = anatomyNode.clone();

      expect(clone.id).toBe(anatomyNode.id);
      expect(clone.name).toBe(anatomyNode.name);
      expect(clone.type).toBe(anatomyNode.type);
      expect(clone.depth).toBe(anatomyNode.depth);
    });

    it('should preserve position and dimensions', () => {
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(50, 80);

      const clone = anatomyNode.clone();

      expect(clone.x).toBe(100);
      expect(clone.y).toBe(200);
      expect(clone.width).toBe(50);
      expect(clone.height).toBe(80);
    });

    it('should preserve radial properties', () => {
      anatomyNode.setRadialProperties({
        angle: Math.PI / 4,
        radius: 150,
        angleStart: 0,
        angleEnd: Math.PI / 2,
      });

      const clone = anatomyNode.clone();

      expect(clone.angle).toBe(Math.PI / 4);
      expect(clone.radius).toBe(150);
      expect(clone.angleStart).toBe(0);
      expect(clone.angleEnd).toBe(Math.PI / 2);
    });

    it('should preserve leaf count and description', () => {
      anatomyNode.leafCount = 10;
      anatomyNode.description = 'Test description';

      const clone = anatomyNode.clone();

      expect(clone.leafCount).toBe(10);
      expect(clone.description).toBe('Test description');
    });

    it('should create independent metadata copy', () => {
      anatomyNode.metadata = { color: 'red', size: 'large' };

      const clone = anatomyNode.clone();

      expect(clone.metadata).toEqual(anatomyNode.metadata);
      expect(clone.metadata).not.toBe(anatomyNode.metadata);

      // Modify the clone's metadata
      clone.metadata.color = 'blue';

      expect(anatomyNode.metadata.color).toBe('red');
      expect(clone.metadata.color).toBe('blue');
    });

    it('should handle empty metadata', () => {
      const clone = anatomyNode.clone();

      expect(clone.metadata).toEqual({});
      expect(clone.metadata).not.toBe(anatomyNode.metadata);
    });

    it('should create independent copies that do not affect each other', () => {
      const clone = anatomyNode.clone();

      // Modify the original
      anatomyNode.setPosition(100, 200);
      anatomyNode.setDimensions(50, 80);
      anatomyNode.description = 'Modified description';
      anatomyNode.metadata = { modified: true };

      // Clone should be unchanged
      expect(clone.x).toBe(0);
      expect(clone.y).toBe(0);
      expect(clone.width).toBe(0);
      expect(clone.height).toBe(0);
      expect(clone.description).toBe('');
      expect(clone.metadata).toEqual({});

      // Modify the clone
      clone.setPosition(300, 400);
      clone.setDimensions(100, 150);
      clone.description = 'Clone description';
      clone.metadata = { clone: true };

      // Original should be unchanged from its modifications
      expect(anatomyNode.x).toBe(100);
      expect(anatomyNode.y).toBe(200);
      expect(anatomyNode.width).toBe(50);
      expect(anatomyNode.height).toBe(80);
      expect(anatomyNode.description).toBe('Modified description');
      expect(anatomyNode.metadata).toEqual({ modified: true });
    });

    it('should handle complex metadata structures', () => {
      anatomyNode.metadata = {
        visual: {
          color: 'red',
          opacity: 0.8,
          styles: ['bold', 'italic'],
        },
        physics: {
          mass: 10,
          velocity: { x: 1, y: 2 },
        },
        tags: ['important', 'visible'],
      };

      const clone = anatomyNode.clone();

      expect(clone.metadata).toEqual(anatomyNode.metadata);
      expect(clone.metadata).not.toBe(anatomyNode.metadata);

      // Note: This is a shallow copy, so nested objects are shared
      clone.metadata.visual.color = 'blue';
      clone.metadata.tags.push('modified');

      expect(anatomyNode.metadata.visual.color).toBe('blue'); // shared reference
      expect(anatomyNode.metadata.tags).toEqual(['important', 'visible', 'modified']); // shared reference
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined values gracefully', () => {
      const node = new AnatomyNode(undefined, undefined, undefined, undefined);

      expect(node.id).toBeUndefined();
      expect(node.name).toBeUndefined();
      expect(node.type).toBeUndefined();
      expect(node.depth).toBeUndefined();
    });

    it('should handle null values gracefully', () => {
      const node = new AnatomyNode(null, null, null, null);

      expect(node.id).toBeNull();
      expect(node.name).toBeNull();
      expect(node.type).toBeNull();
      expect(node.depth).toBeNull();
    });

    it('should handle numeric string values', () => {
      const node = new AnatomyNode('123', '456', '789', '0');

      expect(node.id).toBe('123');
      expect(node.name).toBe('456');
      expect(node.type).toBe('789');
      expect(node.depth).toBe('0');
    });

    it('should handle boolean values', () => {
      const node = new AnatomyNode(true, false, true, false);

      expect(node.id).toBe(true);
      expect(node.name).toBe(false);
      expect(node.type).toBe(true);
      expect(node.depth).toBe(false);
    });
  });
});