#!/usr/bin/env node

globalThis.fetch = async (_input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.has("authorization") || headers.has("cookie")) {
    throw new Error("verification supplied forbidden credentials");
  }

  switch (process.env.FAKE_FETCH_MODE) {
    case "pass":
      return new Response(null, { status: 200 });
    case "not-found":
      return new Response(null, { status: 404 });
    case "network-error":
      throw new Error(
        process.env.SYNTHETIC_TOKEN ?? "synthetic transport error",
      );
    default:
      throw new Error("unknown fake fetch mode");
  }
};
