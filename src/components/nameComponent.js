// src/components/nameComponent.js

import Component from './component.js';

export class NameComponent extends Component {
  /** @param {{value: string}} data */
  constructor(data) {
    super();
    if (!data || typeof data.value !== 'string') {
      throw new Error("NameComponent requires 'value' string in data.");
    }
    this.value = data.value;
  }
}