/**
 * @file Integration tests for data binding system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedTemplateComposer } from '../../../../../src/characterBuilder/templates/utilities/EnhancedTemplateComposer.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.URL = dom.window.URL;

describe('Data Binding Integration Tests', () => {
  let composer;

  beforeEach(() => {
    composer = new EnhancedTemplateComposer();
  });

  describe('Complete Template Processing Pipeline', () => {
    it('should process template with all binding features', () => {
      const template = `
        <div class="app" tb-if="app.initialized">
          <header>
            <h1>{{ app.title | uppercase }}</h1>
            <nav tb-if="user.isLoggedIn">
              <span>Welcome, {{ user.name }}!</span>
              <button tb-on:click="logout">Logout</button>
            </nav>
          </header>
          
          <main>
            <div tb-show="products.length > 0" class="product-list">
              <h2>Products ({{ products.length }})</h2>
              <div tb-for="product in products" tb-key="product.id" class="product-card">
                <h3>{{ product.name }}</h3>
                <p>{{ product.description }}</p>
                <span class="price">{{ product.price | currency }}</span>
                <button 
                  tb-on:click="addToCart(product)" 
                  tb-if="product.inStock"
                  class="btn-primary">
                  Add to Cart
                </button>
                <span tb-else class="out-of-stock">Out of Stock</span>
              </div>
            </div>
            
            <div tb-show="products.length === 0" class="empty-state">
              <p>No products available</p>
            </div>
          </main>
          
          <footer tb-if="app.showFooter">
            <p>&copy; 2023 {{ app.companyName }}</p>
          </footer>
        </div>
      `;

      const context = {
        app: {
          initialized: true,
          title: 'my store',
          showFooter: true,
          companyName: 'ACME Corp',
        },
        user: {
          isLoggedIn: true,
          name: 'John Doe',
        },
        products: [
          {
            id: 1,
            name: 'Laptop',
            description: 'High-performance laptop',
            price: 999.99,
            inStock: true,
          },
          {
            id: 2,
            name: 'Mouse',
            description: 'Wireless mouse',
            price: 29.99,
            inStock: false,
          },
        ],
        addToCart: jest.fn(),
        logout: jest.fn(),
      };

      const result = composer.render(template, context);

      // Check composition worked
      expect(result.html).toContain('MY STORE'); // uppercase filter
      expect(result.html).toContain('Welcome, John Doe!');
      expect(result.html).toContain('Products (2)');

      // Check list rendering
      expect(result.html).toContain('Laptop');
      expect(result.html).toContain('High-performance laptop');
      expect(result.html).toContain('Mouse');
      expect(result.html).toContain('Wireless mouse');

      // Check conditionals
      expect(result.html).toContain('Add to Cart'); // For in-stock item
      expect(result.html).toContain('Out of Stock'); // For out-of-stock item

      // Check footer
      expect(result.html).toContain('© 2023 ACME Corp');

      // Check event bindings were set up
      expect(typeof result.cleanup).toBe('function');
    });

    it('should handle complex nested templates with slots', () => {
      // Register layout template
      composer.registerTemplate(
        'page-layout',
        `
        <div class="layout">
          <header>
            <slot name="header">Default Header</slot>
          </header>
          <main>
            <slot name="content">Default Content</slot>
          </main>
          <footer tb-if="showFooter">
            <slot name="footer">Default Footer</slot>
          </footer>
        </div>
      `
      );

      // Register product card component
      composer.registerTemplate(
        'product-card',
        `
        <div class="card" tb-key="product.id">
          <h3>{{ product.name }}</h3>
          <p>{{ product.description }}</p>
          <div class="actions">
            <button tb-on:click="onSelect" class="select-btn">Select</button>
            <span class="price">{{ product.price | currency }}</span>
          </div>
        </div>
      `
      );

      const template = `
        <template ref="page-layout" />
      `;

      const context = {
        showFooter: true,
        products: [
          {
            id: 1,
            name: 'Product 1',
            description: 'First product',
            price: 10.99,
          },
          {
            id: 2,
            name: 'Product 2',
            description: 'Second product',
            price: 15.99,
          },
        ],
        onSelect: jest.fn(),
        slots: {
          header: '<h1>Product Catalog</h1>',
          content: `
            <div tb-for="product in products">
              <template ref="product-card" context='{"product": product, "onSelect": onSelect}' />
            </div>
          `,
          footer: '<p>Contact us for more info</p>',
        },
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('Product Catalog');
      expect(result.html).toContain('Product 1');
      expect(result.html).toContain('Product 2');
      expect(result.html).toContain('First product');
      expect(result.html).toContain('Contact us for more info');
      expect(result.html).toContain('select-btn');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed templates gracefully', () => {
      const template = `
        <div tb-if="condition">
          <p>{{ missing.deep.property }}</p>
          <span tb-for="item in nonexistent">{{ item }}</span>
        </div>
        <button tb-on:click="nonexistentHandler">Click</button>
      `;

      const context = {
        condition: true,
      };

      expect(() => {
        const result = composer.render(template, context);
        expect(result.html).toBeDefined();
        expect(typeof result.cleanup).toBe('function');
      }).not.toThrow();
    });

    it('should recover from expression evaluation errors', () => {
      const template = `
        <div>
          <p>Safe: {{ name }}</p>
          <p>Risky: {{ user.profile.settings.theme }}</p>
          <p>Math: {{ invalidVar + 5 }}</p>
        </div>
      `;

      const context = {
        name: 'John',
        user: null,
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('Safe: John');
      // Should handle errors gracefully and not crash
      expect(result.html).toBeDefined();
    });

    it('should handle circular references safely', () => {
      const template = '<div>{{ circular.reference }}</div>';

      const circular = { name: 'circular' };
      circular.self = circular;

      const context = { circular };

      expect(() => {
        const result = composer.render(template, context);
        expect(result.html).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Security Validation', () => {
    it('should prevent XSS through interpolation', () => {
      const template = '<div>{{ userInput }}</div>';
      const context = {
        userInput:
          '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
      };

      const result = composer.render(template, context);

      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('onerror');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should sanitize HTML interpolation', () => {
      const template = '<div>{{{ htmlContent }}}</div>';
      const context = {
        htmlContent: '<p>Safe content</p><script>alert("xss")</script>',
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('<p>Safe content</p>');
      expect(result.html).not.toContain('<script>');
    });

    it('should block dangerous expressions', () => {
      const template = '<div>{{ eval("alert(1)") }}</div>';
      const context = {};

      const result = composer.render(template, context);

      // Should not execute dangerous code
      expect(result.html).toBeDefined();
    });

    it('should sanitize event handler expressions', () => {
      const template =
        '<button tb-on:click="eval(maliciousCode)">Click</button>';
      const context = { maliciousCode: 'alert("xss")' };

      // Should render without executing dangerous code
      const result = composer.render(template, context);
      expect(result.html).toContain('<button');
    });
  });

  describe('Real-world Use Cases', () => {
    it('should handle dynamic form generation', () => {
      const template = `
        <form tb-on:submit="handleSubmit">
          <div tb-for="field in formFields" class="form-group">
            <label>{{ field.label }}</label>
            <input 
              type="{{ field.type }}" 
              name="{{ field.name }}"
              tb-if="field.type !== 'select'"
              placeholder="{{ field.placeholder }}"
              tb-on:change="updateField" />
            <select 
              name="{{ field.name }}" 
              tb-if="field.type === 'select'"
              tb-on:change="updateField">
              <option tb-for="option in field.options" value="{{ option.value }}">
                {{ option.label }}
              </option>
            </select>
          </div>
          <button type="submit" tb-if="formValid">Submit</button>
        </form>
      `;

      const context = {
        formFields: [
          {
            name: 'name',
            type: 'text',
            label: 'Name',
            placeholder: 'Enter your name',
          },
          {
            name: 'email',
            type: 'email',
            label: 'Email',
            placeholder: 'Enter your email',
          },
          {
            name: 'country',
            type: 'select',
            label: 'Country',
            options: [
              { value: 'us', label: 'United States' },
              { value: 'ca', label: 'Canada' },
            ],
          },
        ],
        formValid: true,
        handleSubmit: jest.fn(),
        updateField: jest.fn(),
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('Name');
      expect(result.html).toContain('Email');
      expect(result.html).toContain('Country');
      expect(result.html).toContain('United States');
      expect(result.html).toContain('Canada');
      expect(result.html).toContain('type="submit"');
    });

    it('should handle data table with sorting and filtering', () => {
      const template = `
        <div class="data-table">
          <div class="filters">
            <input 
              type="text" 
              placeholder="Search..." 
              tb-on:input="updateFilter" />
            <select tb-on:change="updateSort">
              <option value="name">Sort by Name</option>
              <option value="age">Sort by Age</option>
              <option value="email">Sort by Email</option>
            </select>
          </div>
          
          <table>
            <thead>
              <tr>
                <th tb-on:click="sortBy('name')">Name</th>
                <th tb-on:click="sortBy('age')">Age</th>
                <th tb-on:click="sortBy('email')">Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr tb-for="user in filteredUsers" tb-key="user.id">
                <td>{{ user.name }}</td>
                <td>{{ user.age }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <button tb-on:click="editUser(user)" class="btn-edit">Edit</button>
                  <button tb-on:click="deleteUser(user)" class="btn-delete">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div tb-if="filteredUsers.length === 0" class="empty">
            No users found
          </div>
        </div>
      `;

      const context = {
        filteredUsers: [
          { id: 1, name: 'John Doe', age: 30, email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', age: 25, email: 'jane@example.com' },
        ],
        updateFilter: jest.fn(),
        updateSort: jest.fn(),
        sortBy: jest.fn(),
        editUser: jest.fn(),
        deleteUser: jest.fn(),
      };

      const result = composer.render(template, context);

      expect(result.html).toContain('John Doe');
      expect(result.html).toContain('Jane Smith');
      expect(result.html).toContain('john@example.com');
      expect(result.html).toContain('btn-edit');
      expect(result.html).toContain('btn-delete');
      expect(result.html).not.toContain('No users found');
    });
  });
});
