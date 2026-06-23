declare module '@lapo/asn1js' {
  const ASN1: {
    decode(input: Uint8Array | ArrayBuffer | number[]): unknown;
  };
  export default ASN1;
}
