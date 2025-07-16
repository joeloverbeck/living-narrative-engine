/**
 * @file Unit tests for AnatomyEdge
 * @description Comprehensive unit tests for AnatomyEdge class covering all methods and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyEdge from '../../../../../src/domUI/anatomy-renderer/types/AnatomyEdge.js';

describe('AnatomyEdge', () => {
  let anatomyEdge;

  beforeEach(() => {
    anatomyEdge = new AnatomyEdge('source-id', 'target-id', 'socket-id');
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(anatomyEdge.source).toBe('source-id');
      expect(anatomyEdge.target).toBe('target-id');
      expect(anatomyEdge.socketId).toBe('socket-id');
    });

    it('should initialize with default visual properties', () => {
      expect(anatomyEdge.strokeWidth).toBe(2);
      expect(anatomyEdge.strokeColor).toBe('#666');
      expect(anatomyEdge.strokeOpacity).toBe(0.6);
    });

    it('should initialize path data to null', () => {
      expect(anatomyEdge.pathData).toBeNull();
    });

    it('should initialize empty metadata', () => {
      expect(anatomyEdge.metadata).toEqual({});
    });

    it('should handle different source and target IDs', () => {
      const edge1 = new AnatomyEdge('torso', 'head', 'neck-socket');
      const edge2 = new AnatomyEdge('arm', 'hand', 'wrist-socket');

      expect(edge1.source).toBe('torso');
      expect(edge1.target).toBe('head');
      expect(edge1.socketId).toBe('neck-socket');

      expect(edge2.source).toBe('arm');
      expect(edge2.target).toBe('hand');
      expect(edge2.socketId).toBe('wrist-socket');
    });

    it('should handle special characters in IDs', () => {
      const edge = new AnatomyEdge('left-arm:upper', 'left-arm:lower', 'elbow-socket-123');

      expect(edge.source).toBe('left-arm:upper');
      expect(edge.target).toBe('left-arm:lower');
      expect(edge.socketId).toBe('elbow-socket-123');
    });

    it('should handle undefined values', () => {
      const edge = new AnatomyEdge(undefined, undefined, undefined);

      expect(edge.source).toBeUndefined();
      expect(edge.target).toBeUndefined();
      expect(edge.socketId).toBeUndefined();
    });

    it('should handle null values', () => {
      const edge = new AnatomyEdge(null, null, null);

      expect(edge.source).toBeNull();
      expect(edge.target).toBeNull();
      expect(edge.socketId).toBeNull();
    });
  });

  describe('setVisualProperties', () => {
    it('should set stroke width when provided', () => {
      anatomyEdge.setVisualProperties({ strokeWidth: 5 });

      expect(anatomyEdge.strokeWidth).toBe(5);
      expect(anatomyEdge.strokeColor).toBe('#666'); // unchanged
      expect(anatomyEdge.strokeOpacity).toBe(0.6); // unchanged
    });

    it('should set stroke color when provided', () => {
      anatomyEdge.setVisualProperties({ strokeColor: '#ff0000' });

      expect(anatomyEdge.strokeWidth).toBe(2); // unchanged
      expect(anatomyEdge.strokeColor).toBe('#ff0000');
      expect(anatomyEdge.strokeOpacity).toBe(0.6); // unchanged
    });

    it('should set stroke opacity when provided', () => {
      anatomyEdge.setVisualProperties({ strokeOpacity: 0.8 });

      expect(anatomyEdge.strokeWidth).toBe(2); // unchanged
      expect(anatomyEdge.strokeColor).toBe('#666'); // unchanged
      expect(anatomyEdge.strokeOpacity).toBe(0.8);
    });

    it('should set all visual properties when provided', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: 3,
        strokeColor: '#00ff00',
        strokeOpacity: 0.9,
      });

      expect(anatomyEdge.strokeWidth).toBe(3);
      expect(anatomyEdge.strokeColor).toBe('#00ff00');
      expect(anatomyEdge.strokeOpacity).toBe(0.9);
    });

    it('should not change properties when undefined', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: undefined,
        strokeColor: undefined,
        strokeOpacity: undefined,
      });

      expect(anatomyEdge.strokeWidth).toBe(2);
      expect(anatomyEdge.strokeColor).toBe('#666');
      expect(anatomyEdge.strokeOpacity).toBe(0.6);
    });

    it('should handle zero values', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: 0,
        strokeOpacity: 0,
      });

      expect(anatomyEdge.strokeWidth).toBe(0);
      expect(anatomyEdge.strokeOpacity).toBe(0);
    });

    it('should handle negative values', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: -1,
        strokeOpacity: -0.5,
      });

      expect(anatomyEdge.strokeWidth).toBe(-1);
      expect(anatomyEdge.strokeOpacity).toBe(-0.5);
    });

    it('should handle decimal values', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: 2.5,
        strokeOpacity: 0.75,
      });

      expect(anatomyEdge.strokeWidth).toBe(2.5);
      expect(anatomyEdge.strokeOpacity).toBe(0.75);
    });

    it('should handle empty object', () => {
      anatomyEdge.setVisualProperties({});

      expect(anatomyEdge.strokeWidth).toBe(2);
      expect(anatomyEdge.strokeColor).toBe('#666');
      expect(anatomyEdge.strokeOpacity).toBe(0.6);
    });

    it('should handle partial updates', () => {
      // Set initial values
      anatomyEdge.setVisualProperties({
        strokeWidth: 5,
        strokeColor: '#ff0000',
        strokeOpacity: 0.8,
      });

      // Update only some properties
      anatomyEdge.setVisualProperties({
        strokeWidth: 3,
        strokeColor: '#00ff00',
      });

      expect(anatomyEdge.strokeWidth).toBe(3);
      expect(anatomyEdge.strokeColor).toBe('#00ff00');
      expect(anatomyEdge.strokeOpacity).toBe(0.8); // unchanged
    });

    it('should handle different color formats', () => {
      anatomyEdge.setVisualProperties({ strokeColor: 'red' });
      expect(anatomyEdge.strokeColor).toBe('red');

      anatomyEdge.setVisualProperties({ strokeColor: 'rgb(255, 0, 0)' });
      expect(anatomyEdge.strokeColor).toBe('rgb(255, 0, 0)');

      anatomyEdge.setVisualProperties({ strokeColor: 'rgba(255, 0, 0, 0.5)' });
      expect(anatomyEdge.strokeColor).toBe('rgba(255, 0, 0, 0.5)');
    });
  });

  describe('setPathData', () => {
    it('should set path data string', () => {
      const pathData = 'M 10 10 L 20 20 L 30 10';
      anatomyEdge.setPathData(pathData);

      expect(anatomyEdge.pathData).toBe(pathData);
    });

    it('should handle empty string', () => {
      anatomyEdge.setPathData('');

      expect(anatomyEdge.pathData).toBe('');
    });

    it('should handle null', () => {
      anatomyEdge.setPathData(null);

      expect(anatomyEdge.pathData).toBeNull();
    });

    it('should handle undefined', () => {
      anatomyEdge.setPathData(undefined);

      expect(anatomyEdge.pathData).toBeUndefined();
    });

    it('should handle complex SVG path', () => {
      const complexPath = 'M 100 100 Q 150 50 200 100 T 300 100 Z';
      anatomyEdge.setPathData(complexPath);

      expect(anatomyEdge.pathData).toBe(complexPath);
    });

    it('should overwrite previous path data', () => {
      anatomyEdge.setPathData('M 10 10 L 20 20');
      anatomyEdge.setPathData('M 30 30 L 40 40');

      expect(anatomyEdge.pathData).toBe('M 30 30 L 40 40');
    });
  });

  describe('getId', () => {
    it('should return unique identifier combining source and target', () => {
      expect(anatomyEdge.getId()).toBe('source-id-target-id');
    });

    it('should handle different source and target combinations', () => {
      const edge1 = new AnatomyEdge('torso', 'head', 'neck');
      const edge2 = new AnatomyEdge('head', 'torso', 'neck');

      expect(edge1.getId()).toBe('torso-head');
      expect(edge2.getId()).toBe('head-torso');
    });

    it('should handle special characters in IDs', () => {
      const edge = new AnatomyEdge('left-arm:upper', 'left-arm:lower', 'elbow');

      expect(edge.getId()).toBe('left-arm:upper-left-arm:lower');
    });

    it('should handle numeric IDs', () => {
      const edge = new AnatomyEdge('123', '456', 'socket');

      expect(edge.getId()).toBe('123-456');
    });

    it('should handle empty string IDs', () => {
      const edge = new AnatomyEdge('', '', 'socket');

      expect(edge.getId()).toBe('-');
    });

    it('should handle undefined IDs', () => {
      const edge = new AnatomyEdge(undefined, undefined, 'socket');

      expect(edge.getId()).toBe('undefined-undefined');
    });

    it('should handle null IDs', () => {
      const edge = new AnatomyEdge(null, null, 'socket');

      expect(edge.getId()).toBe('null-null');
    });

    it('should be consistent across multiple calls', () => {
      const id1 = anatomyEdge.getId();
      const id2 = anatomyEdge.getId();

      expect(id1).toBe(id2);
      expect(id1).toBe('source-id-target-id');
    });
  });

  describe('connects', () => {
    it('should return true for direct connection (source -> target)', () => {
      expect(anatomyEdge.connects('source-id', 'target-id')).toBe(true);
    });

    it('should return true for reverse connection (target -> source)', () => {
      expect(anatomyEdge.connects('target-id', 'source-id')).toBe(true);
    });

    it('should return false for unrelated nodes', () => {
      expect(anatomyEdge.connects('other-id', 'another-id')).toBe(false);
    });

    it('should return false for partial matches', () => {
      expect(anatomyEdge.connects('source-id', 'other-id')).toBe(false);
      expect(anatomyEdge.connects('other-id', 'target-id')).toBe(false);
    });

    it('should handle same node ID for both parameters', () => {
      expect(anatomyEdge.connects('source-id', 'source-id')).toBe(false);
      expect(anatomyEdge.connects('target-id', 'target-id')).toBe(false);
    });

    it('should handle undefined parameters', () => {
      expect(anatomyEdge.connects(undefined, undefined)).toBe(false);
      expect(anatomyEdge.connects('source-id', undefined)).toBe(false);
      expect(anatomyEdge.connects(undefined, 'target-id')).toBe(false);
    });

    it('should handle null parameters', () => {
      expect(anatomyEdge.connects(null, null)).toBe(false);
      expect(anatomyEdge.connects('source-id', null)).toBe(false);
      expect(anatomyEdge.connects(null, 'target-id')).toBe(false);
    });

    it('should handle empty string parameters', () => {
      expect(anatomyEdge.connects('', '')).toBe(false);
      expect(anatomyEdge.connects('source-id', '')).toBe(false);
      expect(anatomyEdge.connects('', 'target-id')).toBe(false);
    });

    it('should handle case sensitivity', () => {
      expect(anatomyEdge.connects('SOURCE-ID', 'target-id')).toBe(false);
      expect(anatomyEdge.connects('source-id', 'TARGET-ID')).toBe(false);
    });

    it('should work with different edge configurations', () => {
      const edge1 = new AnatomyEdge('A', 'B', 'socket1');
      const edge2 = new AnatomyEdge('X', 'Y', 'socket2');

      expect(edge1.connects('A', 'B')).toBe(true);
      expect(edge1.connects('B', 'A')).toBe(true);
      expect(edge1.connects('A', 'X')).toBe(false);

      expect(edge2.connects('X', 'Y')).toBe(true);
      expect(edge2.connects('Y', 'X')).toBe(true);
      expect(edge2.connects('X', 'A')).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the anatomy edge', () => {
      // Set up the original edge
      anatomyEdge.setVisualProperties({
        strokeWidth: 5,
        strokeColor: '#ff0000',
        strokeOpacity: 0.8,
      });
      anatomyEdge.setPathData('M 10 10 L 20 20');
      anatomyEdge.metadata = { type: 'joint', flexible: true };

      const clone = anatomyEdge.clone();

      expect(clone).not.toBe(anatomyEdge);
      expect(clone.metadata).not.toBe(anatomyEdge.metadata);
    });

    it('should preserve all basic properties', () => {
      const clone = anatomyEdge.clone();

      expect(clone.source).toBe(anatomyEdge.source);
      expect(clone.target).toBe(anatomyEdge.target);
      expect(clone.socketId).toBe(anatomyEdge.socketId);
    });

    it('should preserve visual properties', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: 3,
        strokeColor: '#00ff00',
        strokeOpacity: 0.9,
      });

      const clone = anatomyEdge.clone();

      expect(clone.strokeWidth).toBe(3);
      expect(clone.strokeColor).toBe('#00ff00');
      expect(clone.strokeOpacity).toBe(0.9);
    });

    it('should preserve path data', () => {
      anatomyEdge.setPathData('M 100 100 Q 150 50 200 100');

      const clone = anatomyEdge.clone();

      expect(clone.pathData).toBe('M 100 100 Q 150 50 200 100');
    });

    it('should create independent metadata copy', () => {
      anatomyEdge.metadata = { type: 'joint', flexible: true, strength: 10 };

      const clone = anatomyEdge.clone();

      expect(clone.metadata).toEqual(anatomyEdge.metadata);
      expect(clone.metadata).not.toBe(anatomyEdge.metadata);

      // Modify the clone's metadata
      clone.metadata.type = 'rigid';
      clone.metadata.newProperty = 'new';

      expect(anatomyEdge.metadata.type).toBe('joint');
      expect(anatomyEdge.metadata.newProperty).toBeUndefined();
      expect(clone.metadata.type).toBe('rigid');
      expect(clone.metadata.newProperty).toBe('new');
    });

    it('should handle empty metadata', () => {
      const clone = anatomyEdge.clone();

      expect(clone.metadata).toEqual({});
      expect(clone.metadata).not.toBe(anatomyEdge.metadata);
    });

    it('should handle null path data', () => {
      anatomyEdge.setPathData(null);

      const clone = anatomyEdge.clone();

      expect(clone.pathData).toBeNull();
    });

    it('should create independent copies that do not affect each other', () => {
      const clone = anatomyEdge.clone();

      // Modify the original
      anatomyEdge.setVisualProperties({
        strokeWidth: 10,
        strokeColor: '#ff0000',
        strokeOpacity: 1.0,
      });
      anatomyEdge.setPathData('M 50 50 L 100 100');
      anatomyEdge.metadata = { modified: true };

      // Clone should be unchanged
      expect(clone.strokeWidth).toBe(2);
      expect(clone.strokeColor).toBe('#666');
      expect(clone.strokeOpacity).toBe(0.6);
      expect(clone.pathData).toBeNull();
      expect(clone.metadata).toEqual({});

      // Modify the clone
      clone.setVisualProperties({
        strokeWidth: 7,
        strokeColor: '#00ff00',
        strokeOpacity: 0.5,
      });
      clone.setPathData('M 20 20 L 40 40');
      clone.metadata = { cloned: true };

      // Original should be unchanged from its modifications
      expect(anatomyEdge.strokeWidth).toBe(10);
      expect(anatomyEdge.strokeColor).toBe('#ff0000');
      expect(anatomyEdge.strokeOpacity).toBe(1.0);
      expect(anatomyEdge.pathData).toBe('M 50 50 L 100 100');
      expect(anatomyEdge.metadata).toEqual({ modified: true });
    });

    it('should handle complex metadata structures', () => {
      anatomyEdge.metadata = {
        visual: {
          style: 'dashed',
          animation: { duration: 300, easing: 'ease-in-out' },
        },
        physics: {
          elasticity: 0.8,
          constraints: ['rotation', 'translation'],
        },
        tags: ['important', 'animated'],
      };

      const clone = anatomyEdge.clone();

      expect(clone.metadata).toEqual(anatomyEdge.metadata);
      expect(clone.metadata).not.toBe(anatomyEdge.metadata);

      // Note: This is a shallow copy, so nested objects are shared
      clone.metadata.visual.style = 'solid';
      clone.metadata.tags.push('modified');

      expect(anatomyEdge.metadata.visual.style).toBe('solid'); // shared reference
      expect(anatomyEdge.metadata.tags).toEqual(['important', 'animated', 'modified']); // shared reference
    });

    it('should preserve getId() functionality', () => {
      const clone = anatomyEdge.clone();

      expect(clone.getId()).toBe(anatomyEdge.getId());
      expect(clone.getId()).toBe('source-id-target-id');
    });

    it('should preserve connects() functionality', () => {
      const clone = anatomyEdge.clone();

      expect(clone.connects('source-id', 'target-id')).toBe(true);
      expect(clone.connects('target-id', 'source-id')).toBe(true);
      expect(clone.connects('other-id', 'another-id')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined constructor parameters', () => {
      const edge = new AnatomyEdge(undefined, undefined, undefined);

      expect(edge.source).toBeUndefined();
      expect(edge.target).toBeUndefined();
      expect(edge.socketId).toBeUndefined();
      expect(edge.getId()).toBe('undefined-undefined');
    });

    it('should handle null constructor parameters', () => {
      const edge = new AnatomyEdge(null, null, null);

      expect(edge.source).toBeNull();
      expect(edge.target).toBeNull();
      expect(edge.socketId).toBeNull();
      expect(edge.getId()).toBe('null-null');
    });

    it('should handle boolean constructor parameters', () => {
      const edge = new AnatomyEdge(true, false, true);

      expect(edge.source).toBe(true);
      expect(edge.target).toBe(false);
      expect(edge.socketId).toBe(true);
      expect(edge.getId()).toBe('true-false');
    });

    it('should handle numeric constructor parameters', () => {
      const edge = new AnatomyEdge(123, 456, 789);

      expect(edge.source).toBe(123);
      expect(edge.target).toBe(456);
      expect(edge.socketId).toBe(789);
      expect(edge.getId()).toBe('123-456');
    });

    it('should handle object constructor parameters', () => {
      const sourceObj = { id: 'source' };
      const targetObj = { id: 'target' };
      const socketObj = { id: 'socket' };

      const edge = new AnatomyEdge(sourceObj, targetObj, socketObj);

      expect(edge.source).toBe(sourceObj);
      expect(edge.target).toBe(targetObj);
      expect(edge.socketId).toBe(socketObj);
      expect(edge.getId()).toBe('[object Object]-[object Object]');
    });

    it('should handle extreme numeric values for visual properties', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: Number.MAX_VALUE,
        strokeOpacity: Number.MIN_VALUE,
      });

      expect(anatomyEdge.strokeWidth).toBe(Number.MAX_VALUE);
      expect(anatomyEdge.strokeOpacity).toBe(Number.MIN_VALUE);
    });

    it('should handle NaN values for visual properties', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: NaN,
        strokeOpacity: NaN,
      });

      expect(anatomyEdge.strokeWidth).toBeNaN();
      expect(anatomyEdge.strokeOpacity).toBeNaN();
    });

    it('should handle Infinity values for visual properties', () => {
      anatomyEdge.setVisualProperties({
        strokeWidth: Infinity,
        strokeOpacity: -Infinity,
      });

      expect(anatomyEdge.strokeWidth).toBe(Infinity);
      expect(anatomyEdge.strokeOpacity).toBe(-Infinity);
    });
  });
});