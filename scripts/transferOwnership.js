const { ethers } = require("hardhat");

// ─── CONFIG ─────────────────────────────────────────────────────
// Paste your Gnosis Safe address here after deployment
const GNOSIS_SAFE = process.env.GNOSIS_SAFE || "0xYOUR_GNOSIS_SAFE_ADDRESS";

// Contract addresses (update after mainnet deploy)
const HCXX_TOKEN_ADDRESS    = process.env.HCXX_TOKEN    || "0xYOUR_HCXX_TOKEN_ADDRESS";
const HCOINX_BADGE_ADDRESS  = process.env.HCOINX_BADGE  || "0xYOUR_BADGE_ADDRESS";
const HCOINX_REWARDS_ADDRESS = process.env.HCOINX_REWARDS || "0xYOUR_REWARDS_ADDRESS";

// Minimal ABI — only what we need
const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external"
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("\n=== HCOINX Ownership Transfer to Gnosis Safe ===");
  console.log("Signer:     ", signer.address);
  console.log("Gnosis Safe:", GNOSIS_SAFE);
  console.log("================================================\n");

  if (GNOSIS_SAFE === "0xYOUR_GNOSIS_SAFE_ADDRESS") {
    throw new Error("Set GNOSIS_SAFE env variable or update the script.");
  }

  const contracts = [
    { name: "HCXXToken",      address: HCXX_TOKEN_ADDRESS },
    { name: "HCOINXBadge",    address: HCOINX_BADGE_ADDRESS },
    { name: "HCOINXRewards",  address: HCOINX_REWARDS_ADDRESS },
  ];

  for (const c of contracts) {
    console.log(`Processing ${c.name} @ ${c.address}`);
    const contract = new ethers.Contract(c.address, OWNABLE_ABI, signer);

    // Verify current owner
    const currentOwner = await contract.owner();
    console.log(`  Current owner: ${currentOwner}`);

    if (currentOwner.toLowerCase() === GNOSIS_SAFE.toLowerCase()) {
      console.log(`  ✅ Already owned by Gnosis Safe. Skipping.\n`);
      continue;
    }

    if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.log(`  ❌ Signer is not the owner. Cannot transfer.\n`);
      continue;
    }

    // Transfer ownership
    const tx = await contract.transferOwnership(GNOSIS_SAFE);
    console.log(`  Tx submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`  ✅ Ownership transferred to Gnosis Safe.\n`);
  }

  console.log("=== All done. Verify on Polygonscan/Etherscan. ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
