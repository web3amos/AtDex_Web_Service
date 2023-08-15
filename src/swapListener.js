const ethers = require('ethers');
const AWS = require('aws-sdk');

const PROJ_ROOT = process.env.PROJ_ROOT;

const logger = require(`${PROJ_ROOT}/src/winston`);
const config = require(`${PROJ_ROOT}/src/config/config.json`); 

const pairAbi = require(`${PROJ_ROOT}/src/abis/pair_abi.json`);
const atDexRouterAbi = require(`${PROJ_ROOT}/src/abis/atCoreRouter_abi.json`);
const atDexRouterAddress = config.atDexRouterAddress;

let registeredPairs = new Set();
let swapStorage = {};
let addressSwapStorage = {};
let chalk;

AWS.config.update({
  region: config.awsRegion,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();


import('chalk').then((module) => {
  chalk = module.default;
});

async function handleForEthSwapEvent(...args) {
  const event = args[args.length - 1];
  console.log(JSON.stringify(event, null, 2));
}


async function loadPairAddressesFromDB() {
  const params = {
      TableName: 'TokenPairs',
      ProjectionExpression: "pairAddress",
  };

  try {
      const result = await dynamoDB.scan(params).promise();
      return result.Items.map(item => item.pairAddress);
  } catch (error) {
      console.error("Error fetching pair addresses from database:", error);
      return [];
  }
}


function convertToNormalNumber(inputNumber) {
  if (typeof inputNumber === 'bigint') {
    return Number(inputNumber) / Math.pow(10, 18);
  } else if (typeof inputNumber === 'number') {
    return inputNumber;
  } else {
    try {
      let rawNumber = BigInt(inputNumber);
      return Number(rawNumber) / Math.pow(10, 18);
    } catch(err) {
      console.error(`Cannot convert input to BigInt: ${inputNumber}`);
      return inputNumber;   
  }
}}


async function storeEventToDynamoDB(userID, transactionHash, eventName, blockNumber, eventData, timestamp, pairAddress) {
  const params = {
  TableName: 'ADP1', 
  Item: {
    'UserID': userID,
    'TransactionHash': transactionHash,
    'EventName': eventName,
    'BlockNumber': blockNumber,
    'EventData': eventData,
    'Timestamp': timestamp,
    'PairAddress': pairAddress,
    'AddressTotalSwap': {
      amount0In: convertToNormalNumber(addressSwapStorage[userID].amount0In),
      amount1In: convertToNormalNumber(addressSwapStorage[userID].amount1In),
      amount0Out: convertToNormalNumber(addressSwapStorage[userID].amount0Out),
      amount1Out: convertToNormalNumber(addressSwapStorage[userID].amount1Out),
    }
  }
};
  try {
  await dynamoDB.put(params).promise();
  logger.info(`Successfully stored event ${eventName} with transaction hash ${transactionHash}`);
  console.log(`Successfully stored event ${eventName} with transaction hash ${transactionHash}`);
  delete swapStorage[transactionHash];
} catch (err) {
    logger.error(`Error occurred when storing event: ${err}`);
    console.error(chalk.red(`Error occurred when storing event: ${err}`));
}
}

async function handleSwapEvent(userID, amount0In, amount1In, amount0Out, amount1Out, to, event) {
  try {
    amount0In = convertToNormalNumber(amount0In);
    amount1In = convertToNormalNumber(amount1In);
    amount0Out = convertToNormalNumber(amount0Out);
    amount1Out = convertToNormalNumber(amount1Out);
    console.log(`************************`);
    console.log(`amount0In: ${amount0In}`);
    console.log(`amount1In: ${amount1In}`);
    console.log(`amount0Out: ${amount0Out}`);
    console.log(`amount1Out: ${amount1Out}`);

    if (event.transactionHash) {
      if (!swapStorage[event.transactionHash]) {
        swapStorage[event.transactionHash] = { amount0In, amount1In, amount0Out, amount1Out };
      } else {
        swapStorage[event.transactionHash].amount0In += amount0In;
        swapStorage[event.transactionHash].amount1In += amount1In;
        swapStorage[event.transactionHash].amount0Out += amount0Out;
        swapStorage[event.transactionHash].amount1Out += amount1Out;
      }
    }

    if (!addressSwapStorage[userID]) {
      addressSwapStorage[userID] = { amount0In, amount1In, amount0Out, amount1Out };
    } else {
      addressSwapStorage[userID].amount0In += amount0In;
      addressSwapStorage[userID].amount1In += amount1In;
      addressSwapStorage[userID].amount0Out += amount0Out;
      addressSwapStorage[userID].amount1Out += amount1Out;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    console.log(`xxxxxxxxxx${JSON.stringify(event, null, 2)}`);
    console.log(`swap Transaction target address: ${to}`);
    logger.info(`swap Transaction target address: ${to}`);

    if (event.transactionHash) {
      console.log(`Transaction Hash: ${event.transactionHash}`);
      console.log(`Address: ${event.address}`);
      const eventData = JSON.stringify({
        ...event,
        args: {
          ...event.args,
          amount0In: swapStorage[event.transactionHash]?.amount0In,
          amount1In: swapStorage[event.transactionHash]?.amount1In,
          amount0Out: swapStorage[event.transactionHash]?.amount0Out,
          amount1Out: swapStorage[event.transactionHash]?.amount1Out,
        },
      });

      // 检查地址是否在TokenPairs表格中或者是否是atDexRouterAddress
      if (!registeredPairs.has(event.address) && event.address !== atDexRouterAddress) {
        await storeEventToDynamoDB(
          userID,
          event.transactionHash,
          event.event,
          event.blockNumber,
          eventData,
          timestamp,
          event.address
        );
      }
    } else {
      logger.info(`Pair listener: Transaction Hash not found`);
      console.log(chalk.red(`Pair listener: Transaction Hash not found`));
    }
  } catch (error) {
    logger.error(`Pair listener: An error occurred while processing the swap event: ${error}`);
    console.error(chalk.red(`Pair listener: An error occurred while processing the swap event: ${error}`));
  }
}


setInterval(() => {
  swapStorage = {};
  // addressSwapStorage = {};
}, 10 * 60 * 1000);

async function start(provider) {
  console.log('xxxxxxxxxxxswap');
 
  const routerContract = new ethers.Contract(atDexRouterAddress, atDexRouterAbi, provider);
  routerContract.on('ForEthSwap', handleForEthSwapEvent);

  const pairAddresses = await loadPairAddressesFromDB();
  pairAddresses.forEach(pairAddress => {
      const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
      pairContract.on('Swap', handleSwapEvent);
     
  });
}

module.exports = {
  start
};