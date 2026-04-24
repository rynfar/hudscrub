// Stub for Node's `module` builtin in the browser bundle.
// mupdf imports this only inside an `if (typeof process !== "undefined")` branch,
// so the actual symbols are never used in the browser path.
export function createRequire() {
  throw new Error('createRequire is not available in the browser');
}
export default { createRequire };
