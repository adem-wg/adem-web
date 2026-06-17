declare module '@lapo/asn1js' {
  const ASN1: {
    decode(input: Uint8Array | ArrayBuffer | number[]): unknown;
  };
  export default ASN1;
}

declare module 'jdataview' {
  export default class jDataView {
    constructor(input: Buffer | Uint8Array | ArrayBuffer);
    skip(length: number): void;
    getBytes(length: number): number[];
  }
}
