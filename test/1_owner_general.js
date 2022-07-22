const {
  contractName, TestSettingAndGetting, TestIfTransactionFails, TestIfTransactionSucceeds
} = require('./shared_resources');

const Predictions = artifacts.require("DogeBetsPredictionV1");


contract(contractName + ' general owner-controlled functionality', (accounts) => {
  const BN = web3.utils.toBN;
  const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];

  /* Constructor-set values */

  it('should have price source pre-set', async () => {
    const predictionsInstance = await Predictions.deployed();
    const priceSource = await predictionsInstance.priceSource.call();
    const referencePriceSource = 'https://api.binance.com/api/v3/ticker/price?symbol=DOGEUSDT';

    assert.equal(priceSource, referencePriceSource, 'price source wasn\'t set correctly');
  });


  it('should have operator address set to the second address for the given mnemonic', async () => {
    const predictionsInstance = await Predictions.deployed();
    const actualOperatorAddress = await predictionsInstance.operatorAddress.call();

    assert.equal(actualOperatorAddress, operatorAddress, 'operator address wasn\'t set correctly');
  });


  /* Regular values */

  it('should be able to inject funds into the contract', async () => {
    const predictionsInstance = await Predictions.deployed();
    const contractAddress = predictionsInstance.address;
    const injectedAmount = 10 ** 8;
    const startingBalance = Number(await web3.eth.getBalance(contractAddress));

    await predictionsInstance.FundsInject({ value: injectedAmount, from: ownerAddress });
    const endingBalance = Number(await web3.eth.getBalance(contractAddress));

    assert.equal(endingBalance, startingBalance + injectedAmount, 'failed to inject funds into the contract');
  });


  it('should be able to extract funds from the contract balance', async () => {
    const predictionsInstance = await Predictions.deployed();
    const extractedAmount = BN(web3.utils.toWei('0.001', 'Ether'));

    await predictionsInstance.FundsInject({ value: extractedAmount, from: ownerAddress });
    const startingBalance = BN(await web3.eth.getBalance(ownerAddress));
    await predictionsInstance.FundsExtract(extractedAmount, { from: ownerAddress });
    const endingBalance = BN(await web3.eth.getBalance(ownerAddress));

    assert(endingBalance > startingBalance , 'failed to extract funds from the contract; ending balance lower than starting');
  });


  it('should be able to transfer funds to other accounts(rewards users) directly from the contract balance', async () => {
    const predictionsInstance = await Predictions.deployed();
    const userWallet = accounts[2];
    const rewardAmount = 10 ** 8;
    const startingUserBalance = Number(await web3.eth.getBalance(userWallet));

    await predictionsInstance.FundsInject({ value: rewardAmount, from: ownerAddress });
    await predictionsInstance.RewardUser(userWallet, rewardAmount, { from: ownerAddress });
    const newUserBalance = Number(await web3.eth.getBalance(userWallet));

    assert.equal(newUserBalance, startingUserBalance + rewardAmount, 'failed to reward a user directly');
  });


  it('should be able to blacklist addresses', async () => {
    const predictionsInstance = await Predictions.deployed();
    const addressToBlacklist = accounts[2];
    await predictionsInstance.BlackListInsert(addressToBlacklist, { from: ownerAddress }),
    // because addresses can not be blacklisted twice, below function should fail and thus pass the assertion
    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.BlackListInsert(addressToBlacklist, { from: ownerAddress }),
      failMessage: 'failed to blacklist an address properly',
      errorMustInclude: 'already blacklisted',
    });
  });


  it('should be able to remove addresses from the blacklist', async () => {
    const predictionsInstance = await Predictions.deployed();
    const blacklistedAddress = accounts[2];
    // this test will fail if BlackListInsert() from the above test failed
    await TestIfTransactionSucceeds({
      Transaction: async () => await predictionsInstance.BlackListRemove(blacklistedAddress, { from: ownerAddress }),
      failMessage: 'failed to remove an address from the blacklist',
    });
  });


  it('should be able to change price source', async () => {
    const predictionsInstance = await Predictions.deployed();
    await TestSettingAndGetting({
      failMessage: 'priceSource wasn\'t updated correctly',
      newValue: 'http://glow-in-the-dark.com',
      Setter: predictionsInstance.ChangePriceSource,
      Getter: predictionsInstance.priceSource,
      from: ownerAddress,
    });
  });


  it('should be able to change reward rate', async () => {
    const predictionsInstance = await Predictions.deployed();
    await TestSettingAndGetting({
      failMessage: 'rewardRate wasn\'t updated correctly',
      newValue: 93,
      Setter: predictionsInstance.SetRewardRate,
      Getter: predictionsInstance.rewardRate,
      from: ownerAddress,
    });
  });


  it('should be able to change minimal user bet size', async () => {
    const predictionsInstance = await Predictions.deployed();
    await TestSettingAndGetting({
      failMessage: 'minBetAmount wasn\'t updated correctly',
      newValue: 1500,
      Setter: predictionsInstance.SetMinBetAmount,
      Getter: predictionsInstance.minBetAmount,
      from: ownerAddress,
    });
  });


  it('should be able to change minial house bet ratio', async () => {
    const predictionsInstance = await Predictions.deployed();
    const minRatio = 75;
    await predictionsInstance.SetHouseBetMinRatio(minRatio, { from: ownerAddress });

    // This is not straightforward, because _houseBetMinRation is a private variable
    // It is only exposed through the currentSettings() method, which returns an array of 7 values
    const currentContractSettings = await predictionsInstance.currentSettings.call();
    const newMinRatio = currentContractSettings[6]; // _houseBetMinRatio is #7 in this array

    assert.equal(newMinRatio, minRatio, 'failed to set new minimal house bet ratio correctly');
  });


  it('should not be able to set minimal house bet ratios outside hardcoded limits', async () => {
    const predictionsInstance = await Predictions.deployed();

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.SetHouseBetMinRatio(0, { from: ownerAddress }),
      failMessage: '_houseBetMinRatio was set below minimal limit of 1',
      errorMustInclude: 'out-of-bounds',
    });
    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.SetHouseBetMinRatio(100, { from: ownerAddress }),
      failMessage: '_houseBetMinRatio was set above maximal limit of 99',
      errorMustInclude: 'out-of-bounds',
    });
  });


  /* Final block. These functions are game-changers, leading up to the one that fully renounces ownership */
  /* As such they brick the contract. And are meant to be tested last */

  it('should be able to change operator address', async () => {
    const predictionsInstance = await Predictions.deployed();
    await TestSettingAndGetting({
      failMessage: 'operator address wasn\'t changed correctly',
      newValue: '0x0000000000000000000000000000000000000001',
      Setter: predictionsInstance.SetOperator,
      Getter: predictionsInstance.operatorAddress,
      from: ownerAddress,
    });
  });


  it('should be able to appoint new owner', async () => {
    const predictionsInstance = await Predictions.deployed();
    const newOwnerAddress = accounts[2];
    await TestSettingAndGetting({
      failMessage: 'new owner wasn\'t set correctly',
      newValue: newOwnerAddress,
      Setter: predictionsInstance.OwnershipTransfer,
      Getter: predictionsInstance.owner,
      from: ownerAddress,
    });

    await predictionsInstance.OwnershipTransfer(ownerAddress, { from: newOwnerAddress }); // restore our ownership again
  });


  it('should be able to renounce contract ownership', async () => {
    const predictionsInstance = await Predictions.deployed();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    await predictionsInstance.OwnershipRenounce({ from: ownerAddress });
    const newOwnerAddress = await predictionsInstance.owner.call();

    assert.equal(newOwnerAddress, zeroAddress, 'failed to renounce ownership: new owner is not zero-address');
  });

});
