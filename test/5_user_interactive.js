// Tests basic user interactions with the contract. Betting, Claiming, Refunds.

/*

 to-do:
  - add a multi-claim check

*/


const {
  contractName, Sleep, TestIfTransactionFails, GetCurrentTimestamp
} = require('./shared_resources');

const Predictions = artifacts.require(contractName);


contract(contractName + ' user interactions', (accounts) => {
  const BN = web3.utils.toBN;
  const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const txArgs = { from: operatorAddress, gas: 5000000, gasPrice: 1000000000 };
  const gasArgs = { gas: 5000000, gasPrice: 1000000000 };
  const roundDuration = 3000; // milliseconds
  const houseBetOnBull = new BN(web3.utils.toWei('0.5', 'Gwei'));
  const houseBetOnBear = new BN(web3.utils.toWei('0.49', 'Gwei'));
  const userBetSize = new BN(web3.utils.toWei('0.01', 'Ether'));
  const referencePrice = 1500 // arbitrary value; used for locking/closing price submissions


  // Most of the test written below are meant to be ran in sequence. Having some of them fail,
  // or changing their order will make the other tests that depend on them fail. Thread lightly.

  it('should let users to enter a round', async () => {
    async function Bootstrap() {
      // specific sequence is required to kickstart the contract; due to contract specifics and a single bug
      const buffer = 2;
      const duration = Number((roundDuration / 1000).toFixed(0));
      predictionsInstance.SetRoundBufferAndInterval(buffer, duration, { from: operatorAddress });
      predictionsInstance.FundsInject({ value: web3.utils.toWei('5', 'Ether'), from: ownerAddress });
      await predictionsInstance.RoundStart({ from: operatorAddress });
      await predictionsInstance.Pause({ from: operatorAddress });
      await predictionsInstance.Unpause({ from: operatorAddress });
      await predictionsInstance.RoundStart({ from: operatorAddress });
    }

    const predictionsInstance = await Predictions.deployed();
    await Bootstrap();
    const currentEpoch = 2;
    predictionsInstance.user_BetBull(currentEpoch, { value: userBetSize, from: user1, ...gasArgs });
    predictionsInstance.user_BetBear(currentEpoch, { value: userBetSize, from: user2, ...gasArgs });
    await Sleep(roundDuration / 3 * 2); // 2/3 of the round's duration; user bets should be through by now
    const startedRound = await predictionsInstance.Rounds(currentEpoch);

    assert.equal(startedRound.bearAmount.toString(), userBetSize.toString(), 'failed to bet on bear');
    assert.equal(startedRound.bullAmount.toString(), userBetSize.toString(), 'failed to bet on bull');
  });


  it('should not let users to re-enter a round', async () => {
    const predictionsInstance = await Predictions.deployed();
    const currentEpoch = 2;

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBull(
        currentEpoch, { value: userBetSize, from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to re-enter rounds; bull side was re-entered',
      errorMustInclude: 'Round not bettable',
    });
    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBear(
        currentEpoch, { value: userBetSize, from: user2, ...gasArgs }),
      failMessage: 'users are not supposed to be able to re-enter rounds; bear side was re-entered',
      errorMustInclude: 'Round not bettable',
    });
  });


  it('should not let users to enter locked/closed rounds', async () => {
    const predictionsInstance = await Predictions.deployed();
    await predictionsInstance.RoundLock(referencePrice, GetCurrentTimestamp(), txArgs);
    await Sleep(roundDuration);
    await predictionsInstance.Execute(referencePrice + 100, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentRoundID = 4;

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBull(
        currentRoundID - 1, { value: userBetSize, from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to enter rounds that are already locked',
      errorMustInclude: 'Bet is too early/late',
    });
    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBear(
        currentRoundID - 2, { value: userBetSize, from: user2, ...gasArgs }),
      failMessage: 'users are not supposed to be able to enter rounds that are already closed',
      errorMustInclude: 'Bet is too early/late',
    });
  });


  it('should not let users to enter a round if their bet amount is below the set minimum', async () => {
    const predictionsInstance = await Predictions.deployed();
    await Sleep(roundDuration / 3 * 2);
    await predictionsInstance.Execute(referencePrice + 200, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentRoundID = 5;
    const minBetAmount = await predictionsInstance.minBetAmount.call();

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBull(
        currentRoundID, { value: minBetAmount - 1, from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to bet below minimal bet size',
      errorMustInclude: 'amount must be greater than minBetAmount',
    });
  });


  it('should not let users to enter a round if they are blacklisted', async () => {
    const predictionsInstance = await Predictions.deployed();
    predictionsInstance.BlackListInsert(user2, { from: ownerAddress });
    await Sleep(roundDuration / 3 * 2);
    await predictionsInstance.Execute(referencePrice + 300, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    const currentRoundID = 6;
    predictionsInstance.user_BetBull(currentRoundID, { value: userBetSize, from: user1, ...gasArgs });

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_BetBull(
        currentRoundID, { value: userBetSize, from: user2, ...gasArgs }),
      failMessage: 'users are not supposed to be able to bet if they are blacklisted',
      errorMustInclude: 'Blacklisted',
    });
  });


  it('should have claiming work as is proper', async () => {
    const predictionsInstance = await Predictions.deployed();
    const wonRoundID = 2;
    let currentRoundID = 6;

    const startingBalance = await web3.eth.getBalance(user1);
    await predictionsInstance.user_Claim([wonRoundID], { from: user1, ...gasArgs });
    const endingBalance = await web3.eth.getBalance(user1);

    assert(BN(endingBalance).gt(BN(startingBalance)), 'failed to claim user\'s winnings');

    await predictionsInstance.Execute(referencePrice + 400, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    currentRoundID += 1;
    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_Claim([wonRoundID], { from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to claim winnings twice for the same round',
      errorMustInclude: 'Not eligible',
    });

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_Claim([currentRoundID - 1], { from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to claim winnings before the round has been closed',
      errorMustInclude: 'has not ended',
    });
  });


  it('should have refunding work as is proper', async () => {
    const predictionsInstance = await Predictions.deployed();
    const canceledRoundID = 6;
    let currentRoundID = 7;

    await Sleep(roundDuration / 3 * 1);
    await predictionsInstance.Execute(referencePrice + 500, GetCurrentTimestamp(), houseBetOnBull, houseBetOnBear, txArgs);
    currentRoundID += 1;
    await predictionsInstance.RoundCancel(canceledRoundID, true, false, txArgs);
    const startingBalance = await web3.eth.getBalance(user1);
    await predictionsInstance.user_Claim([canceledRoundID], { from: user1, ...gasArgs });
    const endingBalance = await web3.eth.getBalance(user1);

    assert(BN(endingBalance).gt(BN(startingBalance)), 'failed to refund user\'s bet');

    await TestIfTransactionFails({
      Transaction: async () => await predictionsInstance.user_Claim([canceledRoundID], { from: user1, ...gasArgs }),
      failMessage: 'users are not supposed to be able to get refunds twice for the same round',
      errorMustInclude: 'Not eligible',
    });
  });


  it('should let users query bets history length at will', async () => {
    const predictionsInstance = await Predictions.deployed();
    const expectedLengthUser1 = 2;
    const expectedLengthUser2 = 1;
    
    const lengthUser1 = (await predictionsInstance.GetUserRoundsLength.call(user1)).toNumber();
    const lengthUser2 = (await predictionsInstance.GetUserRoundsLength.call(user2)).toNumber();

    assert.equal(lengthUser1, expectedLengthUser1, 'wrong length of round history has been reported for user1');
    assert.equal(lengthUser2, expectedLengthUser2, 'wrong length of round history has been reported for user2');
  });


  it('should let users query bets history contents at will', async () => {
    const predictionsInstance = await Predictions.deployed();
    const lengthUser1 = 2;
    const lengthUser2 = 1;
    const user1BetExpected = {
      position: '0',
      amount: userBetSize.toString(),
      claimed: true,
    } 
    const user2BetExpected = {
      position: '1',
      amount: userBetSize.toString(),
      claimed: false,
    } 

    const historyUser1 = await predictionsInstance.GetUserRounds.call(user1, 0, lengthUser1);
    const historyUser2 = await predictionsInstance.GetUserRounds.call(user2, 0, lengthUser2);
    const user1Bet1 = {
      position: historyUser1[1][0].position,
      amount: historyUser1[1][0].amount,
      claimed: historyUser1[1][0].claimed,
    }
    const user1Bet2 = {
      position: historyUser1[1][1].position,
      amount: historyUser1[1][1].amount,
      claimed: historyUser1[1][1].claimed,
    }
    const user2Bet1 = {
      position: historyUser2[1][0].position,
      amount: historyUser2[1][0].amount,
      claimed: historyUser2[1][0].claimed,
    }

    assert.deepEqual(user1Bet1, user1BetExpected, 'bet 1 for user1 was not retrieved correctly');
    assert.deepEqual(user1Bet2, user1BetExpected, 'bet 2 for user1 was not retrieved correctly');
    assert.deepEqual(user2Bet1, user2BetExpected, 'bet 1 for user2 was not retrieved correctly');
  });

});
