// What the TV sent can't be used: a 400, said plainly. On its own so that every route's module can
// throw it without importing the guide, which imports them (a cycle that broke loading them alone)
export class BadRequest extends Error {}
