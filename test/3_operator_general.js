// General operator-accessible functionality test

const {
  contractName
} = require('./shared_resources');

const Predictions = artifacts.require(contractName);

contract(contractName + ' general operator functions', (accounts) => {
  //const ownerAddress = accounts[0];
  const operatorAddress = accounts[1];

  it('should be able to change round duration', async () => {
    const predictionsInstance = await Predictions.deployed();

    const buffer = 3; // a fairly redundant figure. But it's necessary for this function to run
    const duration = 6;
    await predictionsInstance.SetRoundBufferAndInterval(buffer, duration, {from: operatorAddress});
    const newDuration = await predictionsInstance.roundInterval.call();

    assert.equal(newDuration, duration, 'new duration(roundInterval) wasn\'t set correctly');
  });


  it('should be able to enforce owner-set limits on house bets sizes', async () => {
    const predictionsInstance = await Predictions.deployed();
   
    let betOne = web3.utils.toWei('1', 'Ether');
    let betTwo = web3.utils.toWei('0.9', 'Ether');
    const betsWithinLimits = await predictionsInstance.HouseBetsWithinLimits.call(betOne, betTwo, {from: operatorAddress});

    betOne = web3.utils.toWei('1', 'Ether');
    betTwo = web3.utils.toWei('0.85', 'Ether');
    const betsOutsideLimits = await predictionsInstance.HouseBetsWithinLimits.call(betOne, betTwo, {from: operatorAddress});

    assert.equal(betsWithinLimits, true, 'bets that are within defined limits should be allowed');
    assert.equal(betsOutsideLimits, false, 'bets that are outside defined limits should NOT be allowed');
  });
});
