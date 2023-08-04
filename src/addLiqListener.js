const ethers = require('ethers');
const AWS = require('aws-sdk');

PROJ_ROOT=process.env.PROJ_ROOT;
const provider = new ethers.providers.WebSocketProvider('wss://testnet.era.zksync.dev/ws');

const pairAbi = require(`${PROJ_ROOT}/src/abis/pair_abi.json`);
const config = require(`${PROJ_ROOT}/src/config/config.json`); 
const logger = require(`${PROJ_ROOT}/src/winston`);

AWS.config.update({
  region: config.awsRegion,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

let counter = 0;

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

async function getTransactionDetails(transactionHash) {
  try {
    const transaction = await provider.getTransaction(transactionHash);
    logger.info(`From:${transaction.from}`);
    console.log('From:', transaction.from);
    return transaction.from.toString();
  } catch (error) {
    logger.error(`Error getting transaction details:${error}`);
    console.error('Error getting transaction details:', error);
    return null;
  }
}

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
      'PairAddress': pairAddress
    }
  };

  try {
    await dynamoDB.put(params).promise();
    logger.info(`Successfully stored event ${eventName} with transaction hash ${transactionHash}`);
    
  } catch (err) {
    logger.error(`Error occurred when storing event: ${err}`);
    
  }
}

async function handleMintEvent(sender, amount0, amount1, event) {
  counter++;
  const timestamp = Math.floor(Date.now() / 1000);
  const transactionHash = event.transactionHash;
  const userID = await getTransactionDetails(transactionHash);
  logger.info(`Listening no.#${counter} Mint event at ${timestamp}:`);


  await storeEventToDynamoDB(
    userID,
    transactionHash,
    'Mint',
    event.blockNumber,
    JSON.stringify(event),
    timestamp,
    event.address
  );
  logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
}

async function handleBurnEvent(sender, amount0, amount1, to, event) {
  counter++;
  const timestamp = Math.floor(Date.now() / 1000);
  const transactionHash = event.transactionHash;
  const userID = await getTransactionDetails(transactionHash);
  logger.info(`Listening no.#${counter} Burn event at ${timestamp}:`);

  await storeEventToDynamoDB(
    userID,
    transactionHash,
    'Burn',
    event.blockNumber,
    JSON.stringify(event),
    timestamp,
    event.address
  );
  logger.info(`Event object: ${JSON.stringify(event, null, 2)}`);
}

async function start(provider) {
  const listenForMintBurnEvents = async () => {
    const pairAddresses = await loadPairAddressesFromDB();
    pairAddresses.forEach(pairAddress => {
      const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
      pairContract.on('Mint', handleMintEvent);
      pairContract.on('Burn', handleBurnEvent);
    });
  };

  await listenForMintBurnEvents();

  setInterval(async () => {
    await listenForMintBurnEvents();
  }, 60000);
}

module.exports = {
  start
};

