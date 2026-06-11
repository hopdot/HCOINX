// ─── Frontend: How to call the signing API ──────────────────────
// Run in browser with ethers.js loaded

import { ethers } from "ethers";

async function connectWallet() {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

async function performAction(actionId) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const wallet = await connectWallet();

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID(); // unique per request
  const message = `HCOINX:${actionId}:${timestamp}`;

  // User signs the message locally — no gas, no contract call
  const signature = await signer.signMessage(message);

  // Send to backend for verification + on-chain reward
  const res = await fetch("https://your-api.hcoinx.com/api/reward", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, actionId, timestamp, signature, nonce }),
  });

  const data = await res.json();
  if (data.success) {
    console.log("✅ Rewarded! TX:", data.txHash);
  } else {
    console.error("❌ Error:", data.error);
  }
}

// Example usage
// performAction("SHARE_ACTION_001");
