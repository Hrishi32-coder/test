// a collection of simple reusable functions & some constants

exports.contractName = 'DogeBetsPredictionV1';


/* Functions below this point */

/**
 * Attempts to set 'newValue' using 'Setter'. Then retrieves it by using 'Getter'
 * and compares it with the 'newValue'. Shows 'failMessage' in case the two do not match
 * @param {Object} args
 * @param {string} args.failMessage message to display when assertion fails
 * @param {function(any): null} args.Setter contract instance method for setting 'newValue'
 * @param {function(): any} args.Getter contract instance method for getting the wanted value
 * @param {string} args.newValue value supplied to the 'Setter'
 * @param {string} args.from wallet address to send transaction from
 * @returns {void}
 */
async function TestSettingAndGetting({ failMessage, Setter, Getter, newValue, from }) {
  const expectedValue = newValue;
  await Setter(expectedValue, { from: from });
  const actualValue = await Getter.call();

  assert.equal(actualValue, expectedValue, failMessage);
};



/**
 * Runs the supplied 'Transaction' function. If 'errorMustInclude' string is provided, then
 * then '.reason' field of the error that was thrown will have to include it for assertion to succeed
 * Shows 'failMessage' in case transaction succeeds or error doesn't include 'errorMustInclude' substring
 * @param {Object} args
 * @param {function()} args.Transaction contract method with all parameters included; e.g. async () => await contract.Method(value, {from: address})
 * @param {string} args.failMessage message to display when assertion fails
 * @param {string} [args.errorMustInclude=null] substring of error.reason; if it is not found, assertion fails
 * @returns {bool} true if transaction fails; false if it succeeds
 */
async function TestIfTransactionFails({ Transaction, failMessage, errorMustInclude = null }) {
  try {
    await Transaction();
    throw null;
  }
  catch (error) {
    //if (error.reason) console.log(error.reason); // debug
    /* fails if no error was thrown */
    assert(error, failMessage);
    if (errorMustInclude !== null)
      if (error.reason === undefined) // if error.reason must contain something, but is undefined - fail
        assert(false, failMessage);
      else
        /* fails if error thrown doesn't contain 'errorMustInclude' substring */
        /* thus allowing us to specify which specific error passes the assertion, while making all others fail */
        assert(error.reason.includes(errorMustInclude), failMessage)
  }
};


/**
 * Runs the supplied 'Transaction' function. If it runs without errors - returns true 
 * Shows 'failMessage' in case transaction fails
 * @param {Object} args
 * @param {function()} args.Transaction contract method with all parameters included; e.g. async () => await contract.Method(value, {from: address})
 * @param {string} args.failMessage message to display when assertion fails
 * @returns {bool} true if transaction succeeds; false if it fails
 */
async function TestIfTransactionSucceeds({ Transaction, failMessage }) {
  try {
    await Transaction();
    throw null;
  }
  catch (error) {
    assert.equal(error, null, failMessage);
  }
};



/**
 * Something that JS lacks - a waiting function 
 * @param {Number} milliseconds 
 * @returns {void}
 */
async function Sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}


/**
 * Returns UNIX timestamp
 * @returns {String}
 */
function GetCurrentTimestamp() {
  return (Date.now() / 1000).toFixed(0);
}


exports.TestSettingAndGetting = TestSettingAndGetting;
exports.TestIfTransactionFails = TestIfTransactionFails;
exports.TestIfTransactionSucceeds = TestIfTransactionSucceeds;
exports.GetCurrentTimestamp = GetCurrentTimestamp;
exports.Sleep = Sleep;
