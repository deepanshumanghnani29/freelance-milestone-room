// a.js
import { bFunction } from './b.js';
export const myVar = { value: 42 };
console.log('a.js evaluated');

// b.js
import { myVar } from './a.js';
export function bFunction() {
  console.log('myVar at runtime:', myVar);
}
console.log('b.js evaluated');

// main.js
import './a.js';
import { bFunction } from './b.js';
bFunction();
