declare const value: unknown;

const misleadingMarker = "type-escape:";
const escaped = value as any;

export { escaped, misleadingMarker };
