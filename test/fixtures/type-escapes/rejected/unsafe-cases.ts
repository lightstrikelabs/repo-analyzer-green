declare const value: unknown;

const asserted = value as any;
const annotated: any = value;
const angleAsserted = <any>value;
const doubleAsserted = value as unknown as { readonly name: string };

export { angleAsserted, annotated, asserted, doubleAsserted };
