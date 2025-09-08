import { jest } from '@jest/globals';
import { LLMAdapterTestBed } from './tests/e2e/llm-adapter/common/llmAdapterTestBed.js';

// Set up JSDOM environment
global.document = {
  createElement: (tag) => {
    if (tag === 'div') return { id: null, innerHTML: '', style: {} };
    if (tag === 'input') return { value: '', addEventListener: () => {} };
    if (tag === 'h1') return { textContent: '' };
    return {};
  }
};

global.localStorage = {
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

async function testConfiguration() {
  const testBed = new LLMAdapterTestBed();
  
  try {
    await testBed.initialize();
    const { configId, config } = await testBed.getCurrentLLMConfig();
    
    console.log('ConfigId:', configId);
    console.log('Config modelIdentifier:', config?.modelIdentifier);
    console.log('Config configId:', config?.configId);
    console.log('Config displayName:', config?.displayName);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testConfiguration();
