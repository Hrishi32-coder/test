// This set of tests is designed to ensure that operator-controlled functions are working as desired
// Functions in this particular set of tests fall under the routines that are ran many times over
// during contract's normal operation. Many of them will be run thousands of times during its lifetime.


const {
  contractName, Sleep, GetCurrentTimestamp
} = require('./shared_resources');

const Predictions = artifacts.require(contractName);


contract(contractName + ' execution functionality', (accounts) => {
  const BN = web3.utils.toBN;
  const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];
  const txArgs = { from: operatorAddress, gas: 5000000, gasPrice: 1000000000 };
  const zeroBN = new BN(0);
  const roundDuration = 3000; // milliseconds
  const betOnBull = new BN(web3.utils.toWei('0.5', 'Gwei'));
  const betOnBear = new BN(web3.utils.toWei('0.49', 'Gwei'));
  const referencePrice = 1500 // arbitrary value; used for locking/closing price submissions
  var expectedCurrentEpoch = 0;


  // Most of the test written below are meant to be ran in sequence. Having some of them fail,
  // or changing their order will make the other tests that depend on them fail. Thread lightly.

  it('should be able to pause the contract', async () => {
    const predictionsInstance = await Predictions.deployed();
    await predictionsInstance.Pause({ from: operatorAddress });
    const isPaused = await predictionsInstance.IsPaused.call();

    assert.equal(isPaused, true, 'could not pause the contract');
  });


  it('should be able to unpause the contract', async () => {
    const predictionsInstance = await Predictions.deployed();
    await predictionsInstance.Unpause({ from: operatorAddress });
    const isPaused = await predictionsInstance.IsPaused.call();

    assert.equal(isPaused, false, 'could not unpause the contract');
  });


  it('should be able to retrieve current epoch(current round ID)', async () => {
    const predictionsInstance = await Predictions.deployed();
    const currentEpoch = (await predictionsInstance.currentEpoch.call()).toNumber();

    assert.equal(currentEpoch, expectedCurrentEpoch, 'failed to retrieve current epoch or its value is incorrect');
  });


  // RoundStart bits //

  it('should be able to start a round', async () => {
    const predictionsInstance = await Predictions.deployed();
    // Before we can start a round, we decrease round duration(.roundInterval) for ease of testing
    const buffer = 2;
    const duration = Number((roundDuration / 1000).toFixed(0)); // seconds
    await predictionsInstance.SetRoundBufferAndInterval(buffer, duration, { from: operatorAddress });

    // we also make sure that contract balance is not empty, to facilitate house bets in the future tests
    predictionsInstance.FundsInject({ value: web3.utils.toWei('5', 'Ether'), from: ownerAddress });

    await predictionsInstance.RoundStart({ from: operatorAddress });
    expectedCurrentEpoch += 1;
    const startedOnce = await predictionsInstance.startedOnce.call();

    assert.equal(startedOnce, true, 'could not start the round');
  });


  it('should advance current epoch when starting a round', async () => {
    const predictionsInstance = await Predictions.deployed();
    const currentEpoch = (await predictionsInstance.currentEpoch.call()).toNumber();

    assert.equal(currentEpoch, expectedCurrentEpoch, 'current epoch did not advance(didn\'t get increased by one)');
  });


  it('should have updated started round data', async () => {
    const predictionsInstance = await Predictions.deployed();
    const startedRoundID = await predictionsInstance.currentEpoch.call();
    const startedRound = await predictionsInstance.Rounds.call(startedRoundID);

    assert(startedRound.epoch.eq(startedRoundID), 'round\'s epoch wasn\'t set correctly');
    assert.isFalse(startedRound.startTimestamp.eq(zeroBN), 'round\'s startTimestamp wasn\'t set');
    assert.isFalse(startedRound.lockTimestamp.eq(zeroBN), 'round\'s lockTimestamp wasn\'t set');
    assert.isFalse(startedRound.closeTimestamp.eq(zeroBN), 'round\'s closeTimestamp wasn\'t set');
  });


  it('should be able to make house bets on the started round', async () => {
    const predictionsInstance = await Predictions.deployed();
    const startedroundID = await predictionsInstance.currentEpoch.call();

    await predictionsInstance.HouseBet(betOnBull, betOnBear, txArgs);
    const startedRound = await predictionsInstance.Rounds.call(startedroundID);

    assert(startedRound.bullAmount.eq(betOnBull), 'bet on bull side wasn\'t set properly');
    assert(startedRound.bearAmount.eq(betOnBear), 'bet on bear side wasn\'t set properly');
  });


  // RoundLock bits //

  it('should be able to lock a round', async () => {
    const predictionsInstance = await Predictions.deployed();

    await Sleep(roundDuration);
    await predictionsInstance.RoundLock(referencePrice, GetCurrentTimestamp(), txArgs);
    expectedCurrentEpoch += 1;
    const lockedOnce = await predictionsInstance.lockedOnce.call();

    assert.equal(lockedOnce, true, 'could not lock the round');
  });


  it('should advance current epoch when locking a round', async () => {
    const predictionsInstance = await Predictions.deployed();
    const currentEpoch = (await predictionsInstance.currentEpoch.call()).toNumber();

    assert.equal(currentEpoch, expectedCurrentEpoch, 'current epoch did not advance(didn\'t get increased by one)');
  });


  it('should have updated newly started round & locked round data', async () => {
    const predictionsInstance = await Predictions.deployed();
    const startedRoundID = await predictionsInstance.currentEpoch.call();
    const startedRound = await predictionsInstance.Rounds.call(startedRoundID);
    const lockedRound = await predictionsInstance.Rounds.call(startedRoundID - 1);

    // Bear in mind, the round we started in previous tests is now our 'lockedRound'
    assert(startedRound.epoch.eq(startedRoundID), 'round\'s epoch wasn\'t set correctly');
    assert.isFalse(startedRound.startTimestamp.eq(zeroBN), 'round\'s startTimestamp wasn\'t set');
    assert.isFalse(startedRound.lockTimestamp.eq(zeroBN), 'round\'s lockTimestamp wasn\'t set');
    assert.isFalse(startedRound.closeTimestamp.eq(zeroBN), 'round\'s closeTimestamp wasn\'t set');

    assert.isFalse(lockedRound.lockPrice.eq(zeroBN), 'locked round\'s lockPrice wasn\'t set');
    assert.isFalse(lockedRound.lockPriceTimestamp.eq(zeroBN), 'locked round\'s lockPriceTimestamp wasn\'t set');
  });


  // Execute bits //

  it('should be able to execute main contract sequence', async () => {
    async function Workaround() {
      // works around a bug in the contract that prevents executing before round #1 has been closed
      // and it can only be closed by executing. Or if contract got paused after at least one round was started
      await predictionsInstance.Pause({ from: operatorAddress });
      await predictionsInstance.Unpause({ from: operatorAddress });
      await predictionsInstance.RoundStart({ from: operatorAddress });
      expectedCurrentEpoch += 1;
      await predictionsInstance.HouseBet(betOnBull, betOnBear, txArgs);
      await Sleep(roundDuration);
      await predictionsInstance.RoundLock(1500, (Date.now() / 1000).toFixed(0), txArgs);
      expectedCurrentEpoch += 1;
    }

    const predictionsInstance = await Predictions.deployed();
    await Workaround();
    await Sleep(roundDuration);
    const tx = await predictionsInstance.Execute(referencePrice, GetCurrentTimestamp(), betOnBull, betOnBear, txArgs);

    // gas benchmarks
    /*
    console.log({
      gas_used_stock: 302343,
      gas_used_stock_40k: 302234,
      gas_used_factual: tx.receipt.gasUsed,
    });
    */

    expectedCurrentEpoch += 1;
    const currentEpoch = (await predictionsInstance.currentEpoch.call()).toNumber();

    assert.equal(currentEpoch, expectedCurrentEpoch, 'contract failed to execute, based on currentEpoch not having changed');
  });


  it('should have updated started round data after execution', async () => {
    const predictionsInstance = await Predictions.deployed();
    const startedRoundID = await predictionsInstance.currentEpoch.call();
    const startedRound = await predictionsInstance.Rounds.call(startedRoundID);

    assert(startedRound.epoch.eq(new BN(expectedCurrentEpoch)), 'round\'s epoch wasn\'t set correctly');
    assert.isFalse(startedRound.startTimestamp.eq(zeroBN), 'startTimestamp wasn\'t set');
    assert.isFalse(startedRound.lockTimestamp.eq(zeroBN), 'lockTimestamp wasn\'t set');
    assert.isFalse(startedRound.closeTimestamp.eq(zeroBN), 'closeTimestamp wasn\'t set');
    assert(startedRound.bullAmount.eq(betOnBull), 'house bet on bull side wasn\'t set properly');
    assert(startedRound.bearAmount.eq(betOnBear), 'house bet on bear side wasn\'t set properly');
  });


  it('should have updated locked round data after execution', async () => {
    const predictionsInstance = await Predictions.deployed();

    await Sleep(roundDuration);
    await predictionsInstance.Execute(referencePrice + 100, GetCurrentTimestamp(), betOnBull, betOnBear, txArgs);
    expectedCurrentEpoch += 1;

    const currentRoundID = await predictionsInstance.currentEpoch.call();
    const lockedRound = await predictionsInstance.Rounds.call(currentRoundID - 1);

    assert.isFalse(lockedRound.lockPrice.eq(zeroBN), 'lockPrice wasn\'t set');
    assert.isFalse(lockedRound.lockPriceTimestamp.eq(zeroBN), 'lockPriceTimestamp wasn\'t set');
  });


  it('should have updated closed round data after execution', async () => {
    const predictionsInstance = await Predictions.deployed();
    const rewardRate = await predictionsInstance.rewardRate.call();

    await Sleep(roundDuration);
    await predictionsInstance.Execute(referencePrice + 200, GetCurrentTimestamp(), betOnBull, betOnBear, txArgs);
    expectedCurrentEpoch += 1;

    const currentRoundID = await predictionsInstance.currentEpoch.call();
    const closedRound = await predictionsInstance.Rounds.call(currentRoundID - 2);

    assert.isFalse(closedRound.closePrice.eq(zeroBN), 'closePrice wasn\'t set');
    assert.isFalse(closedRound.closePriceTimestamp.eq(zeroBN), 'closePriceTimestamp wasn\'t set');
    assert.equal(closedRound.closed, true, 'closed round is not marked as closed');
    assert(closedRound.closePrice > closedRound.lockPrice,
      'closing price should have been set greater than locking price');
    assert(closedRound.rewardBaseCalAmount.eq(closedRound.bullAmount),
      'rewards werent\'t properly calculated; .rewardBaseCalAmount not set properly');

    const totalAmount = closedRound.bullAmount.add(closedRound.bearAmount);
    const expectedRewardAmount = (totalAmount.mul(rewardRate)).divn(100); // mimics reward calculation formula from the contract

    assert(closedRound.rewardAmount.eq(BN(expectedRewardAmount)),
      'rewards werent\'t properly calculated; .rewardAmount \'' + closedRound.rewardAmount.toString() +
      '\' was supposed to be \'' + expectedRewardAmount.toString() + '\'');
  });


  // Cancelation bits //

  it('should be able to cancel a round', async () => {
    const predictionsInstance = await Predictions.deployed();
    const currentRoundID = await predictionsInstance.currentEpoch.call();
    await predictionsInstance.RoundCancel(currentRoundID - 2, true, false, txArgs);
    const canceledRound = await predictionsInstance.Rounds.call(currentRoundID - 2);

    assert.equal(canceledRound.canceled, true, 'canceled round is not marked as canceled');
    assert.equal(canceledRound.closed, false, 'canceled round is still marked as closed; it should not be');
  });

});
