var HDWalletProvider = require("@truffle/hdwallet-provider")
const mnemonic=process.env.MNEMONIC_PHRASE
module.exports = {
  networks: {
    development: {
     host: "127.0.0.1", 
     port: 8545,            
     network_id: "*",     
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, process.env.INFURA_URL),
      network_id: 3, 
      gas: 4000000, 
    },
  },

  mocha: {
    // timeout: 100000
  },

  db: {
    enabled: false
  }
};
