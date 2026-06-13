const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy HCXXToken (or use existing address)
  const hcxAddress = process.env.HCXX_TOKEN;
  let hcxAddr;

  if (hcxAddress) {
    console.log("Using existing HCXXToken:", hcxAddress);
    hcxAddr = hcxAddress;
  } else {
    const HCXXToken = await ethers.getContractFactory("HCXXToken");
    const hcxx = await HCXXToken.deploy();
    await hcxx.waitForDeployment();
    hcxAddr = await hcxx.getAddress();
    console.log("HCXXToken deployed:", hcxAddr);
  }

  // 2. Deploy PredictionMarket
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const market = await PredictionMarket.deploy(hcxAddr);
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log("PredictionMarket deployed:", marketAddr);

  // 3. Approve PredictionMarket to spend deployer's HCX (for testing)
  const hcx = await ethers.getContractAt("HCXXToken", hcxAddr);
  const approveAmt = ethers.parseUnits("1000000", 18);
  await hcx.approve(marketAddr, approveAmt);
  console.log("Approved 1,000,000 HCX for PredictionMarket");

  // 4. Create sample market
  const tx = await market.createMarket(
    "Storm", "Chicago", "48h", 72,
    60 * 60 * 48 // 48h deadline
  );
  await tx.wait();
  console.log("Sample market created: Storm / Chicago / 72% confidence");

  console.log("\n=== SAVE THESE ADDRESSES ===");
  console.log(`HCXX_TOKEN=${hcxAddr}`);
  console.log(`PREDICTION_MARKET=${marketAddr}`);
  console.log("============================\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
