const ethers = require('ethers');
const AWS = require('aws-sdk');

PROJ_ROOT=process.env.PROJ_ROOT;
const provider = new ethers.providers.WebSocketProvider('wss://testnet.era.zksync.dev/ws');
const config = require(`${PROJ_ROOT}/src/config/config.json`); 
const logger = require(`${PROJ_ROOT}/src/winston`);
const esArrTokenAbi = require(`${PROJ_ROOT}/src/abis/esArrToken_abi.json`);

const esArrTokenAddress = config.esArrTokenAddress;
AWS.config.update({
  region: config.awsRegion,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function getTransactionDetails(transactionHash) {
    try {
      const transaction = await provider.getTransaction(transactionHash);
      logger.info(`From:${transaction.from}`);
      console.log('From:', transaction.from);
      const userFrom = transaction.from.toString();
      return typeof userFrom === 'string' ? userFrom : 'NULL';
    } catch (error) {
      logger.error(`Error getting transaction details:${error}`);
      console.error('Error getting transaction details:', error);
      return 'NULL';  // todo: handle userID 
    }
  }
  

async function storeEventToDynamoDB(userID, transactionHash, eventName, blockNumber, eventData, timestamp, esArrTokenAddress) {
  const params = {
    TableName: 'ADP1',
    Item: {
      'UserID': userID,
      'TransactionHash': transactionHash,
      'EventName': eventName,
      'BlockNumber': blockNumber,
      'EventData': eventData,
      'Timestamp': timestamp,
      'PairAddress': esArrTokenAddress
    }
  };

  try {
    await dynamoDB.put(params).promise();
    logger.info(`Successfully stored event ${eventName} with transaction hash ${transactionHash}`);
    console.log(`Successfully stored event ${eventName} with transaction hash ${transactionHash}`);
  } catch (err) {
    logger.error(`Error occurred when storing event: ${err}`);
    console.error(`Error occurred when storing event: ${err}`);
  }
}

async function handleRedeemEvent(sender, amount0, amount1, event) {
  const timestamp = Math.floor(Date.now() / 1000);
  const transactionHash = event.transactionHash;
  const userID = await getTransactionDetails(transactionHash);


  await storeEventToDynamoDB(
    userID,
    transactionHash,
    'Redeem',
    event.blockNumber,
    JSON.stringify(event),
    timestamp,
    event.address
  );
  logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
  console.log(`Event object: ${JSON.stringify(event, null, 2)}`);
}

async function handleConvertEvent(from, to, amount, event) {
    if (!event) {
      logger.error("Undefined event received in handleConvertEvent.");
      return;
    }
  
    const timestamp = Math.floor(Date.now() / 1000);
    const transactionHash = event.transactionHash;
  
    if (!transactionHash) {
      logger.error("Undefined transactionHash in handleConvertEvent.");
      return;
    }
  
    const userID = await getTransactionDetails(transactionHash);
  
    await storeEventToDynamoDB(
      userID,
      transactionHash,
      'Convert',
      event.blockNumber,
      JSON.stringify(event),
      timestamp,
      event.address
    );
  
    logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
  }


async function handleCancelRedeemEvent(userAddress, esArrAmount, event) {
    const timestamp = Math.floor(Date.now() / 1000);
    const transactionHash = event.transactionHash;
    const userID = await getTransactionDetails(transactionHash);
  
    await storeEventToDynamoDB(
      userID,
      transactionHash,
      'CancelRedeem',
      event.blockNumber,
      JSON.stringify(event),
      timestamp,
      event.address
    );
    logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
    console.log(`Event object: ${JSON.stringify(event, null, 2)}`);
  }

async function handleAllocateEvent(userAddress, usageAddress, amount, event) {
    const timestamp = Math.floor(Date.now() / 1000);
    const transactionHash = event.transactionHash;
    const userID = await getTransactionDetails(transactionHash);
  
    await storeEventToDynamoDB(
      userID,
      transactionHash,
      'Allocate',
      event.blockNumber,
      JSON.stringify(event),
      timestamp,
      event.address
    );
    logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
    console.log(`Event object: ${JSON.stringify(event, null, 2)}`);
  }

async function handleDeallocateEvent(userAddress, usageAddress, amount, fee, event) {
    const timestamp = Math.floor(Date.now() / 1000);
    const transactionHash = event.transactionHash;
    const userID = await getTransactionDetails(transactionHash);
  
    await storeEventToDynamoDB(
      userID,
      transactionHash,
      'Deallocate',
      event.blockNumber,
      JSON.stringify(event),
      timestamp,
      event.address
    );
    logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
    console.log(`Event object: ${JSON.stringify(event, null, 2)}`);
  }

async function start(provider) {
    const listenForEsArrEvents = async () => {
      const pairAddress = esArrTokenAddress;
      const pairContract = new ethers.Contract(pairAddress, esArrTokenAbi, provider);

      pairContract.on('Redeem', handleRedeemEvent);
      pairContract.on('Convert', handleConvertEvent);
      pairContract.on('CancelRedeem', handleCancelRedeemEvent);
      pairContract.on('Allocate', handleAllocateEvent);
      pairContract.on('Deallocate', handleDeallocateEvent);

    };
  
    await listenForEsArrEvents();
  
    setInterval(async () => {
      await listenForEsArrEvents();
    }, 30000);
  }
  
module.exports = {
  start
};

