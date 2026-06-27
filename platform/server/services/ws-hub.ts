import { WebSocketServer, WebSocket } from "ws";

// Centralised owner of the WebSocket server. The previous code created a bare
// WebSocketServer and broadcast to `wss.clients` with no connection lifecycle:
//   - dead/half-open sockets were never detected (they lingered in `clients`
//     with readyState OPEN until the OS TCP keepalive gave up — up to 2h),
//   - broadcast() queued bytes into those sockets with no cap, growing the heap,
//   - a socket 'error' with no listener could throw.
// On a VM (remote/throttled browser, network drops) connections die silently and
// the client reconnects every 2s, so zombies accumulated and RSS climbed until
// the box was starved. WsHub fixes all three: ping/pong heartbeat reaps the dead,
// broadcast() drops back-pressured peers instead of buffering forever, and every
// socket gets an error handler.

export interface WsHubStats {
  /** Sockets currently tracked by the server (healthy + not-yet-reaped). */
  clients: number;
  /** Cumulative count of sockets terminated by the heartbeat for not responding. */
  terminatedDead: number;
  /** Cumulative count of sockets dropped for exceeding the send-buffer limit. */
  droppedBackpressure: number;
  /** Cumulative count of connections accepted since start. */
  totalConnections: number;
}

interface AliveSocket extends WebSocket {
  isAlive?: boolean;
}

const DEFAULT_HEARTBEAT_MS = 30_000;
// A socket that has queued more than this many unsent bytes is not keeping up
// (stalled or dead consumer). Drop it rather than let the heap grow without bound.
const DEFAULT_MAX_BUFFERED_BYTES = 4 * 1024 * 1024; // 4 MB

export interface WsHubOptions {
  heartbeatMs?: number;
  maxBufferedBytes?: number;
}

export class WsHub {
  private readonly wss: WebSocketServer;
  private readonly maxBufferedBytes: number;
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  private terminatedDead = 0;
  private droppedBackpressure = 0;
  private totalConnections = 0;

  constructor(wss: WebSocketServer, opts: WsHubOptions = {}) {
    this.wss = wss;
    this.maxBufferedBytes = opts.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    const heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

    wss.on("connection", (ws: AliveSocket) => {
      this.totalConnections++;
      ws.isAlive = true;
      ws.on("pong", () => { ws.isAlive = true; });
      // Without an error listener a socket error throws and crashes the process.
      ws.on("error", () => { this.safeTerminate(ws); });
    });

    this.heartbeat = setInterval(() => this.reapDead(), heartbeatMs);
    // The heartbeat must not, by itself, keep the process alive.
    this.heartbeat.unref?.();

    wss.on("close", () => this.close());
  }

  /** Ping every client; terminate any that didn't pong since the last tick. */
  private reapDead(): void {
    for (const client of this.wss.clients as Set<AliveSocket>) {
      if (client.isAlive === false) {
        this.terminatedDead++;
        this.safeTerminate(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.ping();
      } catch {
        this.terminatedDead++;
        this.safeTerminate(client);
      }
    }
  }

  /** Send a JSON message to every healthy client, skipping back-pressured ones. */
  broadcast(data: Record<string, unknown>): void {
    const msg = JSON.stringify(data);
    for (const client of this.wss.clients as Set<AliveSocket>) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > this.maxBufferedBytes) {
        // The peer can't keep up — terminating is far cheaper than buffering
        // megabytes per stalled socket until the process runs out of memory.
        this.droppedBackpressure++;
        this.safeTerminate(client);
        continue;
      }
      try {
        client.send(msg);
      } catch {
        this.safeTerminate(client);
      }
    }
  }

  stats(): WsHubStats {
    return {
      clients: this.wss.clients.size,
      terminatedDead: this.terminatedDead,
      droppedBackpressure: this.droppedBackpressure,
      totalConnections: this.totalConnections,
    };
  }

  close(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private safeTerminate(ws: WebSocket): void {
    try {
      ws.terminate();
    } catch {
      /* already gone */
    }
  }
}

/** Minimal broadcaster surface so producers don't depend on the whole hub. */
export interface Broadcaster {
  broadcast(data: Record<string, unknown>): void;
}
