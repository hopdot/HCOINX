require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "a".repeat(64);
const POLYGON_RPC  = process.env.POLYGON_RPC_URL      || "https://polygon-rpc.com";
const MUMBAI_RPC   = process.env.MUMBAI_RPC_URL        || "https://rpc-mumbai.maticvigil.com";
const POLYGONSCAN  = process.env.POLYGONSCAN_API_KEY   || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },

  networks: {
    // Local Hardhat node
    hardhat: {
      chainId: 31337
    },

    // Polygon Mainnet
    polygon: {
      url: POLYGON_RPC,
      accounts: [DEPLOYER_KEY],
      chainId: 137,
      gasPrice: "auto"
    },

    // Polygon Mumbai Testnet
    mumbai: {
      url: MUMBAI_RPC,
      accounts: [DEPLOYER_KEY],
      chainId: 80001,
      gasPrice: "auto"
    }
  },

  etherscan: {
    apiKey: {
      polygon:       POLYGONSCAN,
      polygonMumbai: POLYGONSCAN
    }
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts"
  }
};
