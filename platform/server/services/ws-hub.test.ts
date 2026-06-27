import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { WsHub } from "./ws-hub.js";

let server: Server;
let wss: WebSocketServer;
let hub: WsHub;
let port: number;
const clients: WebSocket[] = [];

function listen(): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 0);
    });
  });
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    clients.push(ws);
    ws.on("error", () => {}); // terminated sockets emit errors client-side; ignore
    ws.on("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) =>
    ws.once("message", (d) => resolve(JSON.parse(d.toString())))
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await wait(10);
  }
}

describe("WsHub", () => {
  beforeEach(async () => {
    server = createServer();
    wss = new WebSocketServer({ server, path: "/ws" });
    port = await listen();
  });

  afterEach(async () => {
    hub?.close();
    for (const c of clients) {
      try { c.terminate(); } catch { /* noop */ }
    }
    clients.length = 0;
    await new Promise<void>((r) => wss.close(() => r()));
    await new Promise<void>((r) => server.close(() => r()));
  });

  test("broadcast delivers JSON to connected clients", async () => {
    hub = new WsHub(wss, { heartbeatMs: 100_000 });
    const ws = await connect();
    await waitFor(() => wss.clients.size === 1);

    const received = nextMessage(ws);
    hub.broadcast({ type: "files-changed", paths: ["a.md"] });
    assert.deepEqual(await received, { type: "files-changed", paths: ["a.md"] });
  });

  test("heartbeat reaps a client that stops responding", async () => {
    hub = new WsHub(wss, { heartbeatMs: 40 });
    const ws = await connect();
    await waitFor(() => wss.clients.size === 1);

    // Pause the underlying socket so the client never reads the ping and so
    // never auto-pongs — exactly a silently-dropped/stalled peer.
    (ws as unknown as { _socket: { pause(): void } })._socket.pause();

    await waitFor(() => hub.stats().terminatedDead >= 1);
    await waitFor(() => wss.clients.size === 0);
    assert.equal(wss.clients.size, 0);
  });

  test("healthy clients survive heartbeats", async () => {
    hub = new WsHub(wss, { heartbeatMs: 30 });
    await connect(); // ws clients auto-respond to pings with pongs
    await waitFor(() => wss.clients.size === 1);

    await wait(150); // several heartbeat cycles
    assert.equal(wss.clients.size, 1);
    assert.equal(hub.stats().terminatedDead, 0);
  });

  test("broadcast drops a back-pressured client instead of buffering", async () => {
    hub = new WsHub(wss, { heartbeatMs: 100_000, maxBufferedBytes: 1000 });
    const ws = await connect();
    await waitFor(() => wss.clients.size === 1);

    // Stall the consumer, then push large payloads. Once the server-side send
    // buffer for this socket exceeds the limit, broadcast() must terminate it.
    (ws as unknown as { _socket: { pause(): void } })._socket.pause();
    const big = "x".repeat(200_000);

    for (let i = 0; i < 100 && hub.stats().droppedBackpressure === 0; i++) {
      hub.broadcast({ type: "files-changed", blob: big });
      await wait(2);
    }

    assert.ok(
      hub.stats().droppedBackpressure >= 1,
      "expected the stalled client to be dropped for back-pressure"
    );
    await waitFor(() => wss.clients.size === 0);
  });

  test("totalConnections counts accepted sockets", async () => {
    hub = new WsHub(wss, { heartbeatMs: 100_000 });
    await connect();
    await connect();
    await waitFor(() => hub.stats().totalConnections === 2);
    assert.equal(hub.stats().totalConnections, 2);
  });
});
