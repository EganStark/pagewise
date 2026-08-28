import assert from "node:assert/strict";
import test from "node:test";

async function request(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", ...init.headers },
      ...init,
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the configured Pagewise entry shell", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Pagewise<\/title>/i);
  if (/Currently reading/i.test(html)) {
    assert.match(html, /Quick log/i);
    assert.match(html, /2026 reading goal/i);
  } else if (/Sign in to your library/i.test(html)) {
    assert.match(html, /Sign in to your library/i);
    assert.match(html, /Email me a sign-in link/i);
    assert.match(html, /Private by design/i);
  } else {
    assert.match(html, /Opening your library/i);
  }
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("AI metadata route fails safely when the optional service is absent", async () => {
  const response = await request("/api/metadata/assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: { title: "Pather Panchali" } }),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "AI metadata assistance is not configured.",
  });
});

test("metadata search rejects empty requests without contacting providers", async () => {
  const response = await request("/api/metadata/search");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "A search query is required.",
  });
});
