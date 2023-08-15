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

async function getUserLpBalance(pairAddress, userAddress) {
  const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
  try {
    const balanceBigNumber = await pairContract.balanceOf(userAddress);
    const decimals = await pairContract.decimals(); // 获取代币的小数位数
    const adjustedBalance = balanceBigNumber.div(ethers.BigNumber.from("10").pow(decimals));
    return adjustedBalance.toString(); 
  } catch (error) {
    logger.error(`Error fetching LP balance for user ${userAddress} with pair address ${pairAddress}: ${error}`);
    return "0";
  }
}


async function storeEventToDynamoDB(userID, transactionHash, eventName, blockNumber, eventData, timestamp, pairAddress) {
  const lpBalance = await getUserLpBalance(pairAddress, userID);
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
      'LPBalance': lpBalance 
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
  logger.info('Entering handleMintEvent function');
  
  const timestamp = Math.floor(Date.now() / 1000);
  const transactionHash = event.transactionHash;

  try {
      const userID = await getTransactionDetails(transactionHash);
      logger.info(`UserID fetched for Mint: ${userID}`);

      await storeEventToDynamoDB(
          userID,
          transactionHash,
          'Mint',
          event.blockNumber,
          JSON.stringify(event),
          timestamp,
          event.address
      );
      logger.info(`Mint event object stored: ${JSON.stringify(event, null, 2)}`);
  } catch (error) {
      logger.error(`Error in handleMintEvent: ${error}`);
  }
}

async function handleBurnEvent(sender, amount0, amount1, to, event) {
  logger.info('Entering handleBurnEvent function');
  
  const timestamp = Math.floor(Date.now() / 1000);
  const transactionHash = event.transactionHash;

  try {
      const userID = await getTransactionDetails(transactionHash);
      logger.info(`UserID fetched for Burn: ${userID}`);

      await storeEventToDynamoDB(
          userID,
          transactionHash,
          'Burn',
          event.blockNumber,
          JSON.stringify(event),
          timestamp,
          event.address
      );
      logger.info(`Burn event object stored: ${JSON.stringify(event, null, 2)}`);
  } catch (error) {
      logger.error(`Error in handleBurnEvent: ${error}`);
  }
}


async function start(provider) {
  const listenForMintBurnEvents = async () => {
    const pairAddresses = await loadPairAddressesFromDB();
    pairAddresses.forEach(pairAddress => {
      const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
      pairContract.on('Mint', (sender, amount0, amount1, event) => {
        logger.info('Mint event detected');
        handleMintEvent(sender, amount0, amount1, event);
    });
    
    pairContract.on('Burn', (sender, amount0, amount1, to, event) => {
        logger.info('Burn event detected');
        handleBurnEvent(sender, amount0, amount1, to, event);
    });
    });
  };

  await listenForMintBurnEvents();

}

module.exports = {
  start
};

