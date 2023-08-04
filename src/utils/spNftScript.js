const ethers = require('ethers');
const AWS = require('aws-sdk');
const path = require('path');
const listenerId = path.basename(__filename, '.js');

const PROJ_ROOT = process.env.PROJ_ROOT;
const addresses = require(`${PROJ_ROOT}/src/config/farmConfig.json`);
const config = require(`${PROJ_ROOT}/src/config/config.json`);
const basePoolAbi = require(`${PROJ_ROOT}/src/abis/basePool_abi.json`);


AWS.config.update({
  region: config.awsRegion,
});
const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function handleTransferEvent(tokenId, to, from, lpTokenAddress, contractAddress) {
  console.log('Transfer event detected:');
  console.log(`- Token ID: ${tokenId}`);
  console.log(`- To: ${to}`);
  console.log(`- From: ${from}`);

  const compositeKey = `${contractAddress}-${to}`;

  const params = {
      TableName: 'spNftTransferEvents',
      Item: {
        'compositeKey': compositeKey,
        'tokenId': Number(tokenId),
        'lpTokenAddress': lpTokenAddress,
        'userAddress': to,
        'from': from,
        'spNftAddress':contractAddress
      }
  };

  try {
      await dynamoDB.put(params).promise();
      console.log("Added item successfully.");
  } catch (err) {
      console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
  }
}

async function getPastEvents(pairContract, lastBlock, provider) {
    const filter = pairContract.filters.Transfer(null, null, null);
    const events = await pairContract.queryFilter(filter, lastBlock, 'latest');
  
    let newBlock = lastBlock;
  
    if (events.length > 0) {
      for (const event of events) {
        const {from, to, tokenId} = event.args;
        newBlock = Math.max(newBlock, event.blockNumber);   
        await handleTransferEvent(tokenId, to, from, pairContract.lpTokenAddress, pairContract.address);
      }
    } else {
      newBlock = await provider.getBlockNumber();
    }
  
    return newBlock;
  }
  
 
  

async function getLastBlock() {
  const getParams = {
    TableName: 'LastProcessedBlock',
    Key: {
      'listenerId': listenerId,
    }
  };

  let result = await dynamoDB.get(getParams).promise();

  if (!result.Item) {
    await setLastBlock(0);
    return 0;
  }

  return result.Item.blockNumber ? result.Item.blockNumber : 0;
}

async function setLastBlock(blockNumber) {
    if (isNaN(blockNumber)) {
      console.error('Invalid block number:', blockNumber);
      return;
    }
  
    const updateParams = {
      TableName: 'LastProcessedBlock',
      Key: {
        'listenerId': listenerId,
      },
      UpdateExpression: "SET blockNumber = :blockNumber",
      ExpressionAttributeValues: {
        ":blockNumber": blockNumber
      },
      ReturnValues: "UPDATED_NEW"
    };
  
    await dynamoDB.update(updateParams).promise();
  }
  
  async function runHistoryDataScript(provider) {
    let lastBlock = await getLastBlock();
    for (let address of addresses) {
      const pairContract = new ethers.Contract(address.contractAddress, basePoolAbi, provider);
      pairContract.lpTokenAddress = address.lpTokenAddress;
      lastBlock = await getPastEvents(pairContract, lastBlock, provider);
      await setLastBlock(lastBlock);
      pairContract.on("Transfer", async (from, to, tokenId, event) => {
          await handleTransferEvent(tokenId, to, from, pairContract.lpTokenAddress, pairContract.address);
          lastBlock = Math.max(lastBlock, event.blockNumber);
          if (!isNaN(lastBlock)) {
            await setLastBlock(lastBlock);
          } else {
            console.error('Invalid block number:', lastBlock);
          }
      });
    }
  }

module.exports = {
  runHistoryDataScript
};

