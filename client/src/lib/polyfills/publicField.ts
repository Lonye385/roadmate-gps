/**
 * Polyfill for Vite's __publicField helper
 * This fixes the "Uncaught ReferenceError: __publicField is not defined" error
 * that occurs when Vite transpiles class fields with the default ES2015 target.
 */

if (typeof (globalThis as any).__publicField === 'undefined') {
  (globalThis as any).__publicField = function (obj: any, key: string, value: any) {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return value;
  };
  console.log('[POLYFILL] __publicField shim installed');
}

// Also add __defNormalProp if needed
if (typeof (globalThis as any).__defNormalProp === 'undefined') {
  (globalThis as any).__defNormalProp = function (obj: any, key: string, value: any) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else {
      obj[key] = value;
    }
    return value;
  };
  console.log('[POLYFILL] __defNormalProp shim installed');
}

export {};
