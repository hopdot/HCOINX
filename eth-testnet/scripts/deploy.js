const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying UltrasonicOracle with:", deployer.address);

  const Oracle = await ethers.getContractFactory("UltrasonicOracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();
  console.log("UltrasonicOracle deployed at:", address);

  // Write address to file for simulator pickup
  const fs = require("fs");
  fs.writeFileSync("./simulator/contract_address.txt", address);
  console.log("Address saved to simulator/contract_address.txt");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
