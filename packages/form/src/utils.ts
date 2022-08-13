import { clone } from 'cosmokit';
import Schema from 'schemastery';

export * from 'cosmokit';
export { Schema };

const primitive = ['string', 'number', 'boolean', 'bitset', 'const'];
const dynamic = ['function', 'transform', 'is'];
const composite = ['array', 'dict'];

export function isObjectSchema(schema: Schema) {
  if (schema.type === 'object') {
    return true;
  } if (schema.type === 'intersect') {
    return schema.list.every(isObjectSchema);
  } if (schema.type === 'union') {
    return getChoices(schema).every(isObjectSchema);
  }
  return false;
}

export function getChoices(schema: Schema) {
  const inner: Schema[] = [];
  const choices = schema.list.filter((item) => {
    if (item.meta.hidden) return;
    if (item.type === 'transform') inner.push(item.inner);
    return !dynamic.includes(item.type);
  });
  return choices.length ? choices : inner;
}

export function getFallback(schema: Schema, required = false) {
  if (!schema || (schema.type === 'union' && getChoices(schema).length === 1)) return;
  return clone(schema.meta?.default) ?? (required ? inferFallback(schema) : undefined);
}

export function inferFallback(schema: Schema) {
  if (schema.type === 'string') return '';
  if (schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  if (['dict', 'object', 'intersect'].includes(schema.type)) return {};
}

export function validate(schema: Schema): boolean {
  if (!schema || schema.meta.hidden) return true;
  if (schema.type === 'object') {
    return Object.values(schema.dict).every(validate);
  } if (schema.type === 'intersect') {
    return schema.list.every(isObjectSchema);
  } if (schema.type === 'union') {
    const choices = getChoices(schema);
    return choices.length === 1 || choices.every((item) => validate(item));
  } if (composite.includes(schema.type)) {
    return validate(schema.inner);
  } if (schema.type === 'tuple') {
    return schema.list.every((item) => primitive.includes(item.type));
  }
  return primitive.includes(schema.type);
}

export function hasTitle(schema: Schema, root?: boolean) {
  if (!schema) return true;
  if (schema.type === 'object') {
    if (schema.meta.description) return true;
    const keys = Object.keys(schema.dict);
    if (!keys.length) return true;
    return hasTitle(schema.dict[keys[0]]);
  } if (schema.type === 'intersect') {
    return hasTitle(schema.list[0]);
  } if (schema.type === 'union') {
    const choices = getChoices(schema);
    return choices.length === 1 ? hasTitle(choices[0]) : false;
  } if (root && composite.includes(schema.type) && validate(schema.inner)) {
    return true;
  }
  return false;
}

export function deepEqual(a: any, b: any) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (!a || !b) return false;

  // check array
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  } if (Array.isArray(b)) {
    return false;
  }

  // check object
  return Object.keys({ ...a, ...b }).every((key) => deepEqual(a[key], b[key]));
}
