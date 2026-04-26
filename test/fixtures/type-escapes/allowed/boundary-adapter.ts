declare const externalValue: unknown;

// type-escape: upstream adapter validates this payload before it reaches the domain
const adapterPayload = externalValue as any;

// type-escape: legacy browser callback has no useful generic signature
const callbackPayload: any = externalValue;

// type-escape: generated SDK type hole is checked by the boundary adapter
const anglePayload = <any>externalValue;

// type-escape: third-party library cannot express this branded test fixture
const doubleAssertedPayload = externalValue as unknown as {
  readonly id: string;
};

export { adapterPayload, anglePayload, callbackPayload, doubleAssertedPayload };
