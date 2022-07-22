const Predictions = artifacts.require("DogeBetsPredictionV1");
const Referrals = artifacts.require("ReferralData");

module.exports = async function (deployer) {
  const ownerAddress = deployer.options.from;

  // hardcoded as the 2nd account of the current seed phrase
  // needs to be replaced manually if the seed phrase('mnemonic') is ever changed
  const operatorAddress = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';
  const priceSource = 'https://api.binance.com/api/v3/ticker/price?symbol=DOGEUSDT';
  await deployer.deploy(Predictions, operatorAddress, priceSource, { gas: 6000000, gasPrice: 1000000000 });
  const predictionsInstance = await Predictions.deployed();
  await deployer.deploy(Referrals, [Predictions.address], { gas: 5000000, gasPrice: 1000000000 });
  await predictionsInstance.SetReferralsContract(Referrals.address);
};
