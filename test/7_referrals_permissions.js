/*

//SetReferralsContract

//WhitelistContract
//SetReferralFee
//DisableReferralFee
//SetReferrals
ReferTo - onlyContract

*/

const {
  contractName, TestIfTransactionFails, TestIfTransactionSucceeds
} = require('./shared_resources');

const Predictions = artifacts.require(contractName);
const Referrals = artifacts.require('ReferralData');


contract(contractName + ' referrals', (accounts) => {
  const BN = web3.utils.toBN;
  const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[4];


  it('should only let the owner to change referrals contract address', async () => {
    const predictionsInstance = await Predictions.deployed();
    const sampleAddress = '0x0000000000000000000000000000000000000001'; // irrelevant
    const TargetFunction = predictionsInstance.SetReferralsContract;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(sampleAddress, { from: operatorAddress }),
      failMessage: 'operator is NOT supposed to be able to change referrals contract address',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(sampleAddress, { from: ownerAddress }),
      failMessage: 'owner is supposed to be able to change referrals contract address',
    });
  });


  it('should only let the owner to whitelist additional predictions contracts', async () => {
    const referralsInstance = await Referrals.deployed();
    const sampleAddress = '0x0000000000000000000000000000000000000001'; // irrelevant
    const TargetFunction = referralsInstance.WhitelistContract;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(sampleAddress, { from: operatorAddress }),
      failMessage: 'only owner is supposed to be able to whitelist additional contracts',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(sampleAddress, { from: ownerAddress }),
      failMessage: 'owner was unable to whitelist additional contract address',
    });
  });


  it('should only let the owner to change referral fee', async () => {
    const referralsInstance = await Referrals.deployed();
    const newFee = 15; // irrelevant
    const TargetFunction = referralsInstance.SetReferralFee;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(newFee, { from: operatorAddress }),
      failMessage: 'only owner is supposed to be able to change referral fee',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(newFee, { from: ownerAddress }),
      failMessage: 'owner was unable to change referral fee',
    });
  });


  it('should only let the owner to disable referral fee', async () => {
    const referralsInstance = await Referrals.deployed();
    const TargetFunction = referralsInstance.DisableReferralFee;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction({ from: operatorAddress }),
      failMessage: 'only owner is supposed to be able to disable referral fee',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction({ from: ownerAddress }),
      failMessage: 'owner was unable to disable referral fee',
    });
  });


  it('should only let the owner to set users\' referrals directly', async () => {
    const referralsInstance = await Referrals.deployed();
    const newReferrals = [ user1, user2 ]; // irrelevant
    const TargetFunction = referralsInstance.SetReferrals;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(user3, newReferrals, { from: operatorAddress }),
      failMessage: 'only owner is supposed to be able to directly modify referrals list for individual users',
      errorMustInclude: 'caller is not the owner',
    });
    await TestIfTransactionSucceeds({
      Transaction: async () => await TargetFunction(user3, newReferrals, { from: ownerAddress }),
      failMessage: 'owner was unable to modify referrals list for a user',
    });
  });


  it('should only let contracts(and not users) to execute ReferTo() function', async () => {
    const referralsInstance = await Referrals.deployed();
    const newReferrer = user3;
    const TargetFunction = referralsInstance.ReferTo;

    await TestIfTransactionFails({
      Transaction: async () => await TargetFunction(newReferrer, { from: user4 }),
      failMessage: 'users(non-contracts) are not supposed to be able to call ReferTo() function on referrals contract',
      errorMustInclude: 'only contracts',
    });
    // not testing for success here, because it is warranted by set of tests for general referrals functionality
  });

});