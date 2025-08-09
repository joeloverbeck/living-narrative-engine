/**
 * @file Memory tests for data binding system
 * @description Tests memory management, cleanup, and leak detection for the template data binding system
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { EnhancedTemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/EnhancedTemplateComposer.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.URL = dom.window.URL;

describe('Data Binding Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let composer;

  beforeEach(async () => {
    // Force garbage collection before each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }

    composer = new EnhancedTemplateComposer();
  });

  afterEach(async () => {
    // Force garbage collection after each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  describe('Cleanup and Memory Management', () => {
    it('should properly cleanup event listeners', () => {
      const template = `
        <div>
          <button tb-on:click="handler1">Button 1</button>
          <button tb-on:click="handler2">Button 2</button>
          <input tb-on:input="handler3" />
        </div>
      `;

      const context = {
        handler1: jest.fn(),
        handler2: jest.fn(),
        handler3: jest.fn(),
      };

      const result = composer.render(template, context, { templateId: 'test' });

      // Should return cleanup function
      expect(typeof result.cleanup).toBe('function');

      // Should be able to cleanup by template ID
      const cleaned = composer.cleanup('test');
      expect(cleaned).toBe(true);
    });

    it('should handle multiple template instances', () => {
      const template = '<button tb-on:click="handler">{{ label }}</button>';

      const result1 = composer.render(
        template,
        {
          label: 'Button 1',
          handler: jest.fn(),
        },
        { templateId: 'btn1' }
      );

      const result2 = composer.render(
        template,
        {
          label: 'Button 2',
          handler: jest.fn(),
        },
        { templateId: 'btn2' }
      );

      expect(result1.html).toContain('Button 1');
      expect(result2.html).toContain('Button 2');

      // Should be able to cleanup individually
      expect(composer.cleanup('btn1')).toBe(true);
      expect(composer.cleanup('btn2')).toBe(true);
    });

    it('should not leak memory with repeated rendering and cleanup', async () => {
      if (!global.memoryTestUtils) {
        console.warn(
          'Memory utilities not available, skipping memory leak test'
        );
        return;
      }

      const template = `
        <div>
          <h1>{{ title }}</h1>
          <ul>
            <li tb-for="item in items" tb-key="item.id">
              {{ item.name }}
              <button tb-on:click="handleClick">Click</button>
            </li>
          </ul>
        </div>
      `;

      // Establish baseline memory
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const iterations = global.memoryTestUtils.isCI() ? 50 : 100;
      const memorySnapshots = [];

      for (let i = 0; i < iterations; i++) {
        const items = Array.from({ length: 20 }, (_, j) => ({
          id: `${i}-${j}`,
          name: `Item ${j}`,
        }));

        const context = {
          title: `Iteration ${i}`,
          items,
          handleClick: jest.fn(),
        };

        const result = composer.render(template, context, {
          templateId: `template-${i}`,
        });

        // Cleanup immediately
        if (result.cleanup) {
          result.cleanup();
        }
        composer.cleanup(`template-${i}`);

        // Take memory snapshot every 10 iterations
        if (i % 10 === 0 && i > 0) {
          await global.memoryTestUtils.forceGCAndWait();
          const currentMemory =
            await global.memoryTestUtils.getStableMemoryUsage();
          memorySnapshots.push(currentMemory);
        }
      }

      // Final memory measurement
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Memory growth should be reasonable (less than 50MB for 100 iterations)
      const memoryGrowth = finalMemory - baselineMemory;
      const growthMB = memoryGrowth / (1024 * 1024);

      expect(growthMB).toBeLessThan(50);

      // Check for steady state (no continuous growth)
      if (memorySnapshots.length > 2) {
        const firstHalf = memorySnapshots.slice(
          0,
          Math.floor(memorySnapshots.length / 2)
        );
        const secondHalf = memorySnapshots.slice(
          Math.floor(memorySnapshots.length / 2)
        );

        const avgFirstHalf =
          firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecondHalf =
          secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        // Second half should not be significantly higher than first half
        const percentIncrease =
          ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;
        expect(percentIncrease).toBeLessThan(20); // Less than 20% increase
      }
    });

    it('should properly cleanup registered templates', () => {
      // Register multiple templates
      composer.registerTemplate('template1', '<div>Template 1</div>');
      composer.registerTemplate('template2', '<div>Template 2</div>');
      composer.registerTemplate('template3', '<div>Template 3</div>');

      // Render instances using registered templates
      const result1 = composer.render(
        '<template ref="template1" />',
        {},
        { templateId: 'instance1' }
      );
      const result2 = composer.render(
        '<template ref="template2" />',
        {},
        { templateId: 'instance2' }
      );

      expect(result1.html).toContain('Template 1');
      expect(result2.html).toContain('Template 2');

      // Cleanup instances
      expect(composer.cleanup('instance1')).toBe(true);
      expect(composer.cleanup('instance2')).toBe(true);

      // Templates should still be registered
      const result3 = composer.render(
        '<template ref="template1" />',
        {},
        { templateId: 'instance3' }
      );
      expect(result3.html).toContain('Template 1');

      composer.cleanup('instance3');
    });

    it('should handle cleanup of non-existent templates gracefully', () => {
      // Attempting to cleanup non-existent template should not throw
      expect(() => {
        const result = composer.cleanup('non-existent');
        expect(result).toBe(false);
      }).not.toThrow();
    });

    it('should cleanup event listeners when template is replaced', () => {
      const template1 = '<button tb-on:click="handler1">Button 1</button>';
      const template2 = '<button tb-on:click="handler2">Button 2</button>';

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Render first template
      const result1 = composer.render(
        template1,
        { handler1 },
        { templateId: 'replaceable' }
      );
      expect(result1.html).toContain('Button 1');

      // Replace with second template using same ID
      const result2 = composer.render(
        template2,
        { handler2 },
        { templateId: 'replaceable' }
      );
      expect(result2.html).toContain('Button 2');

      // Cleanup should work for the current template
      expect(composer.cleanup('replaceable')).toBe(true);
    });
  });

  describe('Memory efficiency with large datasets', () => {
    it('should efficiently manage memory with large repeated renders', async () => {
      if (!global.memoryTestUtils) {
        console.warn(
          'Memory utilities not available, skipping efficiency test'
        );
        return;
      }

      const template = `
        <table>
          <tbody>
            <tr tb-for="row in rows" tb-key="row.id">
              <td>{{ row.col1 }}</td>
              <td>{{ row.col2 }}</td>
              <td>{{ row.col3 }}</td>
            </tr>
          </tbody>
        </table>
      `;

      await global.memoryTestUtils.forceGCAndWait();
      const startMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Render large table multiple times
      for (let i = 0; i < 10; i++) {
        const rows = Array.from({ length: 500 }, (_, j) => ({
          id: `${i}-${j}`,
          col1: `Data ${i}-${j}-1`,
          col2: `Data ${i}-${j}-2`,
          col3: `Data ${i}-${j}-3`,
        }));

        const result = composer.render(
          template,
          { rows },
          {
            templateId: `large-table-${i}`,
          }
        );

        // Immediate cleanup
        composer.cleanup(`large-table-${i}`);
      }

      await global.memoryTestUtils.forceGCAndWait();
      const endMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const memoryUsed = (endMemory - startMemory) / (1024 * 1024);

      // Should use less than 20MB for this operation
      expect(memoryUsed).toBeLessThan(20);
    });
  });
});
