// HCOINX Mesh WebSocket Relay Server v2
// Broadcasts peer list to all nodes on join/leave.
// Run: node relay/server.mjs

import { WebSocketServer } from "ws";

const PORT = 8080;
const wss  = new WebSocketServer({ port: PORT });
const nodes = new Map(); // nodeID -> ws

wss.on("connection", (ws) => {
  let nodeID = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── Register ────────────────────────────────────────────────
    if (msg.type === "register") {
      nodeID = msg.nodeID;
      nodes.set(nodeID, ws);
      console.log(`[+] ${nodeID} joined  (total: ${nodes.size})`);

      // 1. Tell everyone else this node joined
      broadcast({ type: "info", text: `${nodeID} joined the mesh` }, nodeID);

      // 2. Send the NEW node a full peer list
      ws.send(JSON.stringify({ type: "peers", list: [...nodes.keys()] }));

      // 3. Push updated peer list to everyone
      broadcastPeerList();
      return;
    }

    // ── Packet relay ────────────────────────────────────────────
    if (msg.type === "packet") {
      console.log(`[relay] ${nodeID} → all | Packet #${msg.packet?.packetID}`);
      broadcast(msg, nodeID);
    }
  });

  ws.on("close", () => {
    if (nodeID) {
      nodes.delete(nodeID);
      console.log(`[-] ${nodeID} left    (remaining: ${nodes.size})`);
      broadcast({ type: "info", text: `${nodeID} left the mesh` });
      broadcastPeerList();
    }
  });

  ws.on("error", (err) => console.error("WS error:", err.message));
});

function broadcast(msg, excludeID = null) {
  const data = JSON.stringify(msg);
  for (const [id, client] of nodes) {
    if (id !== excludeID && client.readyState === 1) client.send(data);
  }
}

function broadcastPeerList() {
  const list = [...nodes.keys()];
  const data = JSON.stringify({ type: "peers", list });
  for (const [, client] of nodes) {
    if (client.readyState === 1) client.send(data);
  }
}

console.log(`HCOINX Mesh Relay v2 running on ws://localhost:${PORT}`);
