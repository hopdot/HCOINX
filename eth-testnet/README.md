# HCOINX Ethereum Testnet + Mesh Simulator

Local Hardhat testnet with UltrasonicOracle smart contract and a fully autonomous browser-based mesh node simulator with real-time WebSocket relay.

## Quick Start (4 terminals)

### Terminal 1 — Install & start Hardhat node
```bash
cd eth-testnet
npm install
npm run node
# → RPC: http://127.0.0.1:8545
# → 20 pre-funded test accounts
```

### Terminal 2 — Deploy UltrasonicOracle
```bash
npm run deploy
# → Logs contract address
# → Saves to simulator/contract_address.txt
```

### Terminal 3 — Start WebSocket relay
```bash
npm run relay
# → ws://localhost:8080
```

### Terminal 4 — Open simulator in 3+ browser tabs
Open `simulator/index.html` in multiple tabs.

Per tab:
- Set a unique Node ID (NODE1, NODE2, NODE3...)
- Paste the contract address
- Click **Connect Node** (connects both Ethereum + WebSocket relay)
- Click **Auto-Broadcast**

## What happens
- Each node generates ultrasonic sensor readings every 10 seconds
- Packets propagate across tabs via WebSocket relay with TTL rebroadcasting
- Every received packet is auto-submitted to the local Hardhat chain
- On-chain NewData events fire and appear in all connected tabs
- Duplicate packets are deduplicated per node

## Architecture

```
  NODE1 tab          NODE2 tab          NODE3 tab
     |                   |                   |
     +------WebSocket Relay (ws://8080)------+
     |          (server.mjs)                 |
     |                                       |
     +------------ Hardhat Node -------------+
                  (localhost:8545)
                  UltrasonicOracle.sol
```

## Files
```
eth-testnet/
  contracts/UltrasonicOracle.sol   Smart contract
  scripts/deploy.js                Hardhat deploy script
  relay/server.mjs                 WebSocket mesh relay (Node.js)
  simulator/index.html             Browser multi-node simulator
  hardhat.config.js                Hardhat config (Solidity 0.8.20)
  package.json                     Dependencies + scripts
```
