/**
 * @file Performance tests for data binding system
 * @description Tests performance and scalability of the template data binding system
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EnhancedTemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/EnhancedTemplateComposer.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.URL = dom.window.URL;

describe('Data Binding Performance Tests', () => {
  let composer;

  beforeEach(() => {
    composer = new EnhancedTemplateComposer();
  });

  describe('Performance and Scalability', () => {
    it('should handle large lists efficiently', () => {
      const template = `
        <div>
          <h2>Items ({{ items.length }})</h2>
          <ul>
            <li tb-for="item in items" tb-key="item.id">
              Item #{{ item.id }}: {{ item.name }}
            </li>
          </ul>
        </div>
      `;

      // Create large dataset
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
      }));

      const context = { items };

      const startTime = performance.now();
      const result = composer.render(template, context);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 150ms)
      expect(endTime - startTime).toBeLessThan(150);

      expect(result.html).toContain('Items (100)');
      expect(result.html).toContain('Item #1');
      expect(result.html).toContain('Item #100');
    });

    it('should handle deep nesting efficiently', () => {
      const template = `
        <div tb-for="category in categories">
          <h2>{{ category.name }}</h2>
          <div tb-for="subcategory in category.subcategories">
            <h3>{{ subcategory.name }}</h3>
            <ul>
              <li tb-for="item in subcategory.items" tb-key="item.id">
                {{ item.name }} - {{ item.price | currency }}
              </li>
            </ul>
          </div>
        </div>
      `;

      const context = {
        categories: [
          {
            name: 'Electronics',
            subcategories: [
              {
                name: 'Computers',
                items: [
                  { id: 1, name: 'Laptop', price: 999.99 },
                  { id: 2, name: 'Desktop', price: 799.99 },
                ],
              },
              {
                name: 'Phones',
                items: [
                  { id: 3, name: 'iPhone', price: 699.99 },
                  { id: 4, name: 'Android', price: 599.99 },
                ],
              },
            ],
          },
          {
            name: 'Clothing',
            subcategories: [
              {
                name: 'Shirts',
                items: [
                  { id: 5, name: 'T-Shirt', price: 19.99 },
                  { id: 6, name: 'Button-up', price: 39.99 },
                ],
              },
            ],
          },
        ],
      };

      const startTime = performance.now();
      const result = composer.render(template, context);
      const endTime = performance.now();

      // Should handle nested rendering efficiently
      expect(endTime - startTime).toBeLessThan(100);

      expect(result.html).toContain('Electronics');
      expect(result.html).toContain('Computers');
      expect(result.html).toContain('Laptop');
      expect(result.html).toContain('$999.99');
      expect(result.html).toContain('Clothing');
      expect(result.html).toContain('T-Shirt');
    });

    it('should handle extremely large datasets with acceptable performance', () => {
      const template = `
        <table>
          <tbody>
            <tr tb-for="row in rows" tb-key="row.id">
              <td>{{ row.id }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.value }}</td>
            </tr>
          </tbody>
        </table>
      `;

      // Create very large dataset for stress testing
      const rows = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Row ${i + 1}`,
        value: Math.random() * 1000,
      }));

      const context = { rows };

      const startTime = performance.now();
      const result = composer.render(template, context);
      const endTime = performance.now();

      // Should handle 1000 rows in reasonable time (less than 3000ms)
      // Note: This is a stress test with 1000 rows, so we allow more time
      expect(endTime - startTime).toBeLessThan(3000);

      expect(result.html).toContain('Row 1');
      expect(result.html).toContain('Row 1000');
    });

    it('should maintain performance with complex expressions', () => {
      const template = `
        <div tb-for="item in items" tb-if="item.visible && item.price > threshold">
          <h3>{{ item.name | uppercase }}</h3>
          <p>Price: {{ item.price | currency }}</p>
          <p>Discount: {{ (item.price * discountRate) | currency }}</p>
          <p>Final: {{ (item.price * (1 - discountRate)) | currency }}</p>
        </div>
      `;

      const items = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: 10 + Math.random() * 990,
        visible: i % 2 === 0,
      }));

      const context = {
        items,
        threshold: 50,
        discountRate: 0.15,
      };

      const startTime = performance.now();
      const result = composer.render(template, context);
      const endTime = performance.now();

      // Complex expressions should still be performant
      expect(endTime - startTime).toBeLessThan(200);

      expect(result.html).toBeDefined();
      expect(result.html.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for typical use cases', () => {
      const benchmarks = [
        {
          name: 'Simple interpolation',
          template: '<div>{{ message }}</div>',
          context: { message: 'Hello World' },
          maxTime: 5,
        },
        {
          name: 'Small list (10 items)',
          template: '<ul><li tb-for="item in items">{{ item }}</li></ul>',
          context: { items: Array.from({ length: 10 }, (_, i) => `Item ${i}`) },
          maxTime: 10,
        },
        {
          name: 'Medium list (100 items)',
          template: '<ul><li tb-for="item in items">{{ item }}</li></ul>',
          context: {
            items: Array.from({ length: 100 }, (_, i) => `Item ${i}`),
          },
          maxTime: 50,
        },
        {
          name: 'Nested conditionals',
          template: `
            <div tb-if="show">
              <p tb-if="nested">Nested</p>
              <p tb-else>Not nested</p>
            </div>
          `,
          context: { show: true, nested: true },
          maxTime: 10,
        },
      ];

      benchmarks.forEach((benchmark) => {
        const startTime = performance.now();
        const result = composer.render(benchmark.template, benchmark.context);
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(benchmark.maxTime);
        expect(result.html).toBeDefined();
      });
    });
  });
});
