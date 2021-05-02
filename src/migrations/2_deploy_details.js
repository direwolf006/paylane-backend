var Details=artifacts.require("Details");

module.exports = function(_deployer) {
  // Use deployer to state migration tasks.
  _deployer.deploy(Details);
  
};
