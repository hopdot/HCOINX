import express from "express";
import { ethers } from "ethers";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import dotenv from "dotenv";
import { rewardsAbi } from "./abi/rewardsAbi.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(helmet()); // CSP + security headers

// ─── Rate Limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 requests per wallet per window
  keyGenerator: (req) => req.body.wallet || req.ip,
  message: { error: "Too many requests. Slow down." },
});
app.use("/api/reward", limiter);

// ─── Provider & Signer ──────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const rewards = new ethers.Contract(
  process.env.REWARDS_ADDRESS,
  rewardsAbi,
  signer
);

// ─── Nonce Store (in-memory; use Redis in production) ───────────
const usedNonces = new Set();

// ─── Signature Verification ─────────────────────────────────────
function verifySignature(wallet, actionId, timestamp, signature) {
  const message = `HCOINX:${actionId}:${timestamp}`;
  const recovered = ethers.verifyMessage(message, signature);
  return recovered.toLowerCase() === wallet.toLowerCase();
}

function isExpired(timestamp) {
  const FIVE_MINUTES = 5 * 60 * 1000;
  return Date.now() - parseInt(timestamp) > FIVE_MINUTES;
}

// ─── POST /api/reward ────────────────────────────────────────────
app.post("/api/reward", async (req, res) => {
  const { wallet, actionId, timestamp, signature, nonce } = req.body;

  // 1. Validate required fields
  if (!wallet || !actionId || !timestamp || !signature || !nonce) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // 2. Check signature expiry
  if (isExpired(timestamp)) {
    return res.status(401).json({ error: "Signature expired." });
  }

  // 3. Check nonce (replay protection)
  const nonceKey = `${wallet}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return res.status(409).json({ error: "Nonce already used." });
  }

  // 4. Verify wallet signature
  if (!verifySignature(wallet, actionId, timestamp, signature)) {
    return res.status(403).json({ error: "Invalid signature." });
  }

  // 5. Mark nonce as used
  usedNonces.add(nonceKey);

  // 6. Call on-chain reward
  try {
    const tx = await rewards.reward(wallet, actionId);
    await tx.wait();
    return res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Contract call failed:", err);
    return res.status(500).json({ error: "Contract call failed.", detail: err.message });
  }
});

// ─── Health check ───────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HCOINX Signing API running on port ${PORT}`));
