
const {
  contractName, Sleep, TestIfTransactionFails, GetCurrentTimestamp,
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
  const user4 = accounts[5];
  const user5 = accounts[6];
  const user6 = accounts[7];
  const txArgs = { from: operatorAddress, gas: 5000000, gasPrice: 1000000000 };
  const gasArgs = { gas: 5000000, gasPrice: 1000000000 };
  const roundDuration = 3000; // milliseconds
  const houseBetOnBull = new BN(web3.utils.toWei('0.5', 'Gwei'));
  const houseBetOnBear = new BN(web3.utils.toWei('0.49', 'Gwei'));
  const userBetSize = new BN(web3.utils.toWei('0.01', 'Ether'));
  const referencePrice = 1500 // arbitrary value; used for locking/closing price submissions


  it('should have predictions contract whitelisted by referrals contract upon deployment', async () => {
    const referralsInstance = await Referrals.deployed();
    const shouldBeWhitelisted = await referralsInstance.IsWhitelisted.call(Predictions.address);
    const shouldNotBetWhitelisted = await referralsInstance.IsWhitelisted.call(Referrals.address);

    assert(shouldBeWhitelisted, 'predictions contract wasn\'t whitelisted when referrals contract was being deployed');
    assert.isFalse(shouldNotBetWhitelisted, 'whitelisting doesn\'t seem to be working right; referrals contract should not have its own address whitelisted');

  });


  it('should have referrals contract address set in the predictions contract', async () => {
    const predictionsInstance = await Predictions.deployed();

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.SetReferralsContract(Referrals.address, { from: ownerAddress }),
      failMessage: 'referrals contract was set incorrectly; check migrations/2_deploy_contracts.js',
      errorMustInclude: 'this address is already set',
    });
  });
  

  it('should allow referrals contract owner to whitelist additional addresses', async () => {
    const referralsInstance = await Referrals.deployed();
    const sampleAddress = '0x0000000000000000000000000000000000000001';
    const allowedBeforeWhitelisting = await referralsInstance.IsWhitelisted.call(sampleAddress);

    await referralsInstance.WhitelistContract(sampleAddress, {from: ownerAddress});
    const allowedAfterWhitelisting = await referralsInstance.IsWhitelisted.call(sampleAddress);

    assert.equal(allowedAfterWhitelisting, !allowedBeforeWhitelisting, 'sample address did not get whitelisted');
  });


  it('should allow referrals contract owner to change the referral fee', async () => {
    const referralsInstance = await Referrals.deployed();
    const newFee = 15;

    await referralsInstance.SetReferralFee(newFee, {from: ownerAddress});
    const updatedReferralFee = await referralsInstance.referralFee.call();
    await referralsInstance.DisableReferralFee({from: ownerAddress});
    const disabledReferralFee = await referralsInstance.referralFee.call();

    assert.equal(BN(newFee).toString(), updatedReferralFee.toString(), 'referral fee wasn\'t changed');
    assert.equal(BN(0).toString(), disabledReferralFee.toString(), 'referral fee wasn\'t disabled');
  });


  it('should allow referrals contract owner to set other people\'s referrals directly', async () => {
    const referralsInstance = await Referrals.deployed();
    const newReferrals = [ user5, user6 ];
    const user5AlreadyReferredInitial = await referralsInstance.IsAlreadyReferred.call(user5);
    const user6AlreadyReferredInitial = await referralsInstance.IsAlreadyReferred.call(user6);

    await referralsInstance.SetReferrals(user4, newReferrals, {from: ownerAddress});
    const user5AlreadyReferred = await referralsInstance.IsAlreadyReferred.call(user5);
    const user6AlreadyReferred = await referralsInstance.IsAlreadyReferred.call(user6);
    const user5Referrer = await referralsInstance.GetReferrer.call(user5);
    const user6Referrer = await referralsInstance.GetReferrer.call(user6);
    const user4Referrals = await referralsInstance.GetReferrals.call(user4);

    assert.equal(user5AlreadyReferred, !user5AlreadyReferredInitial, 'user5 should now be referred');
    assert.equal(user6AlreadyReferred, !user6AlreadyReferredInitial, 'user6 should now be referred');
    assert.equal(user5Referrer, user4, 'user5 did not get their referrer set to user4');
    assert.equal(user6Referrer, user4, 'user6 did not get their referrer set to user4');
    assert.deepEqual(user4Referrals, newReferrals, 'referrals for user4 weren\'t properly set');
  });


  // Most of the tests written below are meant to be ran in sequence. Having some of them fail,
  // or changing their order will make the other tests that depend on them fail. Thread lightly.

  it('should be able to add new referrals correctly', async () => {
    async function Bootstrap() {
      const buffer = 2;
      const duration = Number((roundDuration / 1000).toFixed(0));
      predictionsInstance.FundsInject({ value: web3.utils.toWei('5', 'Ether'), from: ownerAddress });
      await predictionsInstance.SetRoundBufferAndInterval(buffer, duration, { from: operatorAddress });
      await predictionsInstance.RoundStart({ from: operatorAddress });
    }

    const predictionsInstance = await Predictions.deployed();
    const referralsInstance = await Referrals.deployed();
    await Bootstrap();
    const currentEpoch = 1;

    const tx = await predictionsInstance.user_BetBullSpecial(currentEpoch, user3, { value: userBetSize, from: user1, ...gasArgs });
    const user1Referrer = await referralsInstance.GetReferrer.call(user1);
    const user3Referrals = await referralsInstance.GetReferrals.call(user3);

    /*
    console.log({
      gas_used_bare: 140418,
      gas_used_monolithic_function: 205338,
      gas_used_separate_requirements: 205367,
      gas_used_separate_referrals: 205395,
      gas_used_fully_separate: 205486,
      gas_used_fully_separate_40k: 205302,
      gas_used_factual: tx.receipt.gasUsed,
    });
    */

    assert.equal(user1Referrer, user3, 'user1 referrer was not set correctly');
    assert.deepEqual(user3Referrals, [user1], 'user3 referrals were not set correctly');
  });


  it('should keep track of referral rewards', async () => {
    const predictionsInstance = await Predictions.deployed();
    const referralsInstance = await Referrals.deployed();
    await predictionsInstance.Pause(txArgs); // necessary to kickstart the contract properly
    await predictionsInstance.Unpause(txArgs);
    await predictionsInstance.RoundStart(txArgs);
    const referralFee = await referralsInstance.referralFee.call();
    const currentEpoch = 2;

    const tx = await predictionsInstance.user_BetBull(currentEpoch, { value: userBetSize, from: user1, ...gasArgs });

    /*
    console.log({
      gas_used_stock: 146098,
      gas_used_stock_full: 168298,
      gas_used_one_less_requirement: 168135,
      gas_used_factual: tx.receipt.gasUsed,
    })
    */

    const user3Reward = (await predictionsInstance.ReferralRewardsAvailable.call(user3)).toString();
    const user3RewardExp = (await referralsInstance.CalculateReferralReward.call(userBetSize)).toString();
    const user3RewardExpManual = (userBetSize.mul(BN(referralFee))).divn(1000); // userBetSize * referralFee / 1000

    assert.equal(user3RewardExp, user3RewardExpManual.toString(), 'referral reward is not being calculated correctly');
    assert.equal(user3Reward, user3RewardExp, 'user3 referral reward was not set correctly');
  });


  it('should not change referrer for those who are already referred', async () => {
    const predictionsInstance = await Predictions.deployed();
    const referralsInstance = await Referrals.deployed();
    await Sleep(roundDuration / 3 * 2);
    await predictionsInstance.RoundLock(referencePrice, GetCurrentTimestamp(), txArgs);
    const currentEpoch = 3;

    await predictionsInstance.user_BetBullSpecial(currentEpoch, user2, { value: userBetSize, from: user1, ...gasArgs });
    const user1Referrer = await referralsInstance.GetReferrer.call(user1);
    const user3Referrals = await referralsInstance.GetReferrals.call(user3);

    assert.equal(user1Referrer, user3, 'user1 referrer was changed');
    assert.deepEqual(user3Referrals, [user1], 'user3 referrals were changed');
  });


  it('should support referring multiple users', async () => {
    const predictionsInstance = await Predictions.deployed();
    const referralsInstance = await Referrals.deployed();
    await Sleep(roundDuration / 3 * 1);
    await predictionsInstance.Execute(referencePrice + 100, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentEpoch = 4;

    await predictionsInstance.user_BetBullSpecial(currentEpoch, user3, { value: userBetSize, from: user2, ...gasArgs });
    const user1Referrer = await referralsInstance.GetReferrer.call(user1);
    const user2Referrer = await referralsInstance.GetReferrer.call(user1);
    const user3Referrals = await referralsInstance.GetReferrals.call(user3);

    assert.equal(user1Referrer, user2Referrer, 'user2 referrer was not set correctly');
    assert.deepEqual(user3Referrals, [user1, user2], 'user3 referrals do not include user1 & user2');
  });


  it('should not allow to refer themselves', async () => {
    const predictionsInstance = await Predictions.deployed();
    await Sleep(roundDuration / 3 * 1);
    await predictionsInstance.Execute(referencePrice + 200, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentEpoch = 5;

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBullSpecial(
        currentEpoch, user3, { value: userBetSize, from: user3, ...gasArgs }),
      failMessage: 'should not be able to refer an address to itself',
      errorMustInclude: 'refer self',
    });
  });


  it('should not allow to refer one\'s own referrer, e.g. user1 -> user2 -> user1', async () => {
    const predictionsInstance = await Predictions.deployed();
    const referralsInstance = await Referrals.deployed();
    await Sleep(roundDuration / 3 * 2);
    await predictionsInstance.Execute(referencePrice + 300, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentEpoch = 6;

    const expectedUser2Referrals = [];
    await predictionsInstance.user_BetBullSpecial(currentEpoch, user2, { value: userBetSize, from: user3, ...gasArgs });
    const actualUser2Referrals = await referralsInstance.GetReferrals.call(user2);
    
    assert.deepEqual(actualUser2Referrals, expectedUser2Referrals, 'user2 referrals were changed; meaning that user3 got referred to them; not good');
  });


  it('should allow for users to claim their referral rewards', async () => {
    const predictionsInstance = await Predictions.deployed();
    const rewards = await predictionsInstance.ReferralRewardsAvailable.call(user3);
    const startingBalance = BN(await web3.eth.getBalance(user3));

    const tx = await predictionsInstance.user_ReferralFundsClaim({ from: user3, ...gasArgs });
    const gasPrice = parseInt(tx.receipt.effectiveGasPrice, 16);
    const gasUsed = BN(tx.receipt.gasUsed * gasPrice);
    const endingBalance = BN(await web3.eth.getBalance(user3)).add(gasUsed);

    assert.equal(endingBalance.toString(), (startingBalance.add(rewards)).toString(), 'referral funds weren\'t claimed properly');
  });


  it('should not allow for users to double-claim their referral rewards', async () => {
    const predictionsInstance = await Predictions.deployed();
    const startingBalance = BN(await web3.eth.getBalance(user3));

    const tx = await predictionsInstance.user_ReferralFundsClaim({ from: user3, ...gasArgs });
    const gasPrice = parseInt(tx.receipt.effectiveGasPrice, 16);
    const gasUsed = BN(tx.receipt.gasUsed * gasPrice);
    const endingBalance = BN(await web3.eth.getBalance(user3)).add(gasUsed);

    assert.equal(endingBalance.toString(), startingBalance.toString(), 'no referral funds should be claimable; ' + 
      'this can also fail if some other funny bug with gas happens on truffle\'s side');
  });

});