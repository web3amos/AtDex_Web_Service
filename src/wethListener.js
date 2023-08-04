const ethers = require('ethers');
const AWS = require('aws-sdk');

PROJ_ROOT=process.env.PROJ_ROOT;

const pairAbi = require(`${PROJ_ROOT}/src/abis/weth_abi.json`);
const config = require(`${PROJ_ROOT}/src/config/config.json`); 
const logger = require(`${PROJ_ROOT}/src/winston`);
const pairAddress = config.wethAddress;

AWS.config.update({
  region: config.awsRegion,
});


async function handleWithdrawalEvent(event) {
  logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
}


async function start(provider) {
    console.log('xxxxxxxxxxx WETH Withdrawal event');
    const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
    pairContract.on('Withdrawal', handleWithdrawalEvent);
  }


module.exports = {
  start
};

