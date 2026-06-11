// HCOINX Mesh WebSocket Relay Server
// Nodes connect here and broadcast mesh packets to all peers in real time.
// Run: node relay/server.mjs

import { WebSocketServer } from "ws";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const nodes = new Map(); // nodeID -> ws

wss.on("connection", (ws) => {
  let nodeID = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Registration handshake
    if (msg.type === "register") {
      nodeID = msg.nodeID;
      nodes.set(nodeID, ws);
      console.log(`[+] Node registered: ${nodeID} (total: ${nodes.size})`);
      broadcast({ type: "info", text: `${nodeID} joined the mesh` }, nodeID);
      return;
    }

    // Mesh packet relay — forward to all OTHER nodes
    if (msg.type === "packet") {
      console.log(`[relay] ${nodeID} → all | Packet #${msg.packet?.packetID}`);
      broadcast(msg, nodeID);
    }
  });

  ws.on("close", () => {
    if (nodeID) {
      nodes.delete(nodeID);
      console.log(`[-] Node disconnected: ${nodeID} (remaining: ${nodes.size})`);
      broadcast({ type: "info", text: `${nodeID} left the mesh` }, nodeID);
    }
  });

  ws.on("error", (err) => console.error("WS error:", err.message));
});

function broadcast(msg, excludeID = null) {
  const data = JSON.stringify(msg);
  for (const [id, client] of nodes) {
    if (id !== excludeID && client.readyState === 1) {
      client.send(data);
    }
  }
}

console.log(`HCOINX Mesh Relay running on ws://localhost:${PORT}`);
