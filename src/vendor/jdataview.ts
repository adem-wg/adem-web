export default class jDataView {
  private readonly bytes: Uint8Array;
  private offset = 0;

  constructor(input: ArrayBuffer | Uint8Array) {
    this.bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  }

  skip(length: number): void {
    this.offset += length;
    if (this.offset > this.bytes.length) {
      throw new RangeError('jDataView offset is outside the buffer');
    }
  }

  getBytes(length: number): number[] {
    const end = this.offset + length;
    if (end > this.bytes.length) {
      throw new RangeError('jDataView read is outside the buffer');
    }
    const result = Array.from(this.bytes.slice(this.offset, end));
    this.offset = end;
    return result;
  }
}
