# HCOINX Ethereum Testnet + Mesh Simulator

Local Hardhat testnet with UltrasonicOracle smart contract and a fully autonomous browser-based mesh node simulator.

## Quick Start

### 1. Install dependencies
```bash
cd eth-testnet
npm install
```

### 2. Start the local Hardhat node (keep this terminal open)
```bash
npm run node
# → Local RPC: http://127.0.0.1:8545
# → 20 pre-funded test accounts
```

### 3. Deploy UltrasonicOracle (new terminal)
```bash
npm run deploy
# → Logs the contract address
# → Saves to simulator/contract_address.txt
```

### 4. Open the browser simulator
Open `simulator/index.html` in multiple browser tabs.

- Paste the contract address from step 3
- Set a unique Node ID per tab (NODE1, NODE2, NODE3...)
- Click **Connect Node**
- Click **Start Auto-Broadcast**

Each node will:
- Generate ultrasonic sensor readings every 10 seconds
- Propagate with TTL-based mesh rebroadcasting
- Automatically submit each packet to the local Hardhat chain
- Display live on-chain confirmation with TX hash

## Architecture

```
Browser Tab (NODE1)          Browser Tab (NODE2)
  ↓ sensor reading             ↓ sensor reading
  ↓ mesh propagation ←→ rebroadcast with TTL
  ↓
  submitPacket() → Hardhat Node (localhost:8545)
                       ↓
                 UltrasonicOracle.sol
                 emit NewData event
```

## Files
- `contracts/UltrasonicOracle.sol` — on-chain data storage
- `scripts/deploy.js` — Hardhat deploy script
- `hardhat.config.js` — Hardhat config (Solidity 0.8.20, localhost network)
- `simulator/index.html` — autonomous multi-node mesh + Ethereum simulator
