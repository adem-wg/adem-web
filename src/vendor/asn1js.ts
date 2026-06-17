import asn1Source from '@lapo/asn1js/asn1.js?raw';
import int10Source from '@lapo/asn1js/int10.js?raw';
import oidsSource from '@lapo/asn1js/oids.js?raw';

type RequireMap = Record<string, string>;

const sources: RequireMap = {
  './int10': int10Source,
  './int10.js': int10Source,
  './oids': oidsSource,
  './oids.js': oidsSource,
};

const cache = new Map<string, unknown>();

function evaluateCommonJs(source: string, requireFn: (name: string) => unknown): unknown {
  const module = { exports: {} as unknown };
  const run = new Function(
    'module',
    'exports',
    'require',
    'window',
    `${source}\n;return module.exports;`,
  ) as (
    module: { exports: unknown },
    exports: unknown,
    require: (name: string) => unknown,
    windowObject: typeof globalThis,
  ) => unknown;

  return run(module, module.exports, requireFn, globalThis);
}

function requireDependency(name: string): unknown {
  if (cache.has(name)) {
    return cache.get(name);
  }

  const source = sources[name];
  if (source === undefined) {
    throw new Error(`Unsupported ASN.1 dependency: ${name}`);
  }

  const loaded = evaluateCommonJs(source, requireDependency);
  cache.set(name, loaded);
  return loaded;
}

const ASN1 = evaluateCommonJs(asn1Source, requireDependency);

export default ASN1;
