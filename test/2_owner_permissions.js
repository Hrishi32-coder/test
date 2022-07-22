// This set of tests is designed to ensure that critical contract functionality is
// only changeable by the owner. And not changeable by the operator.
// Operator permissions don't require a separte test, because they are tested by other operator tests
// If some operator permissions are wrong - it will be apparent during the running of those tests(they'll fail)

const {
  contractName, TestIfTransactionFails, TestIfTransactionSucceeds
} = require('./shared_resources');

const Predictions = artifacts.require(contractName);


contract(contractName + ' owner permissions exclusivity', (accounts) => {
  const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];


  it('should only let the owner to inject funds into the contract', async () => {
    const predictionsInstance = await Predictions.deployed();
    const injectAmount = 10 ** 8; // irrelevant*
    const TargetFunction = predictionsInstance.FundsInject;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction({ value: injectAmount, from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to inject funds into the contract',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction({ value: injectAmount, from: ownerAddress }),
      failMessage: 'owner is supposed to be able to inject funds into the contract',
    });
  });


  it('should only let the owner to extract funds from the contract', async () => {
    const predictionsInstance = await Predictions.deployed();
    const extractAmount = 10 ** 8; // irrelevant*
    const TargetFunction = predictionsInstance.FundsExtract;

    // first need to add some funds to the contract balance
    await predictionsInstance.FundsInject({ value: extractAmount, from: ownerAddress });

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(extractAmount, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to extract funds from the contract',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(extractAmount, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to extract funds from the contract',
    });
  });


  it('should only let the owner to transfer funds to other accounts(rewards users) directly from the contract balance', async () => {
    const predictionsInstance = await Predictions.deployed();
    const userWallet = accounts[2];
    const rewardAmount = 10 ** 8; // irrelevant*
    const TargetFunction = predictionsInstance.RewardUser;

    // first need to add some funds to the contract balance
    await predictionsInstance.FundsInject({ value: rewardAmount, from: ownerAddress });

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(userWallet, rewardAmount, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to reward users directly from contract balance',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(userWallet, rewardAmount, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to reward users directly from contract balance',
    });
  });


  it('should only let the owner to blacklist addresses', async () => {
    const predictionsInstance = await Predictions.deployed();
    const addressToBlacklist = '0x0000000000000000000000000000000000000001'; // irrelevant*
    const TargetFunction = predictionsInstance.BlackListInsert;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(addressToBlacklist, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to blacklist addresses',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(addressToBlacklist, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to blacklist addresses',
    });
  });


  it('should only let the owner to remove blacklisted addresses', async () => {
    const predictionsInstance = await Predictions.deployed();
    const blacklistedAddress = '0x0000000000000000000000000000000000000001'; // irrelevant*
    const TargetFunction = predictionsInstance.BlackListRemove;

    // this test will fail if BlackListInsert() from the above test failed
    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(blacklistedAddress, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to remove addresses from the blacklist',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(blacklistedAddress, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to remove addresses from the blacklist',
    });
  });


  it('should only let the owner to change price source', async () => {
    const predictionsInstance = await Predictions.deployed();
    const priceSource = 'http://glow-in-the-dark.com'; // irrelevant*
    const TargetFunction = predictionsInstance.ChangePriceSource

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(priceSource, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change the price source',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(priceSource, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to change the price source',
    });
  });


  it('should only let the owner to change reward rate', async () => {
    const predictionsInstance = await Predictions.deployed();
    const rewardRate = 93; // irrelevant*
    const TargetFunction = predictionsInstance.SetRewardRate

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(rewardRate, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change reward rate',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(rewardRate, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to change reward rate',
    });
  });


  it('should only let the owner to change minimal user bet size', async () => {
    const predictionsInstance = await Predictions.deployed();
    const minBetAmount = 1500; // irrelevant*
    const TargetFunction = predictionsInstance.SetMinBetAmount

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(minBetAmount, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change minimal user bet size',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(minBetAmount, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to change minimal user bet size',
    });
  });


  it('should only let the owner to change minimal house bet ratio', async () => {
    const predictionsInstance = await Predictions.deployed();
    const minRatio = 75; // irrelevant*
    const TargetFunction = predictionsInstance.SetHouseBetMinRatio

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(minRatio, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change minimal house bet ratio',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(minRatio, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to change minimal house bet ratio',
    });
  });


  /* Final block. These functions are game-changers, leading up to the one that fully renounces ownership */
  /* As such they brick the contract. And are meant to be tested last */

  it('should only let the owner to change operator address', async () => {
    const predictionsInstance = await Predictions.deployed();
    const newOperatorAddress = '0x0000000000000000000000000000000000000001'; // irrelevant*
    const TargetFunction = predictionsInstance.SetOperator;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(newOperatorAddress, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to set new operator address',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(newOperatorAddress, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to set new operator address',
    });
  });


  it('should only let the owner to appoint new owner', async () => {
    const predictionsInstance = await Predictions.deployed();
    const newOwnerAddress = accounts[2];
    const TargetFunction = predictionsInstance.OwnershipTransfer;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(newOwnerAddress, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change the owner',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(newOwnerAddress, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to transfer ownership',
    });

    await predictionsInstance.OwnershipTransfer(ownerAddress, { from: newOwnerAddress }); // restore our ownership again
  });


  it('should only let the owner to renounce contract onwership', async () => {
    const predictionsInstance = await Predictions.deployed();
    const TargetFunction = predictionsInstance.OwnershipRenounce;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction({ from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to remove owner address',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction({ from: ownerAddress }),
      failMessage: 'owner is supposed to be able to renounce ownership of the contract',
    });
  });


  // * - irrelevant - exact figure is irrelevant within the scope of this test
});
