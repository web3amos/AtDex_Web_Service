const ethers = require('ethers');
const AWS = require('aws-sdk');
const path = require('path');
const PROJ_ROOT = process.env.PROJ_ROOT;
const config = require(`${PROJ_ROOT}/src/config/config.json`);
const gNftAbi = require(`${PROJ_ROOT}/src/abis/gNft_abi.json`);
const address = config.gNftAddress;
const listenerId = path.basename(__filename, '.js'); 

AWS.config.update({
  region: config.awsRegion,
});
const dynamoDB = new AWS.DynamoDB.DocumentClient();

function getContract(provider) {
    return new ethers.Contract(address, gNftAbi, provider);
}

async function handleEvent(tokenId, to, from) {
    console.log('Transfer event detected:');
    console.log(`- Gnft Token ID: ${tokenId}`);
    console.log(`- To: ${to}`);
    console.log(`- From: ${from}`);

    if (from && from !== '0x0000000000000000000000000000000000000000') {
        try {
            const getParamsFrom = {
                TableName: 'gNftTransferEvents',
                Key: {
                    'userAddress': from,
                }
            };
            let resultFrom = await dynamoDB.get(getParamsFrom).promise();
            let existingTokenIdsFrom = resultFrom.Item && resultFrom.Item.tokenIds ? resultFrom.Item.tokenIds : [];

            let tokenIdIndex = existingTokenIdsFrom.indexOf(Number(tokenId));
            if (tokenIdIndex > -1) {
                existingTokenIdsFrom.splice(tokenIdIndex, 1);
            }

            const updateParamsFrom = {
                TableName: 'gNftTransferEvents',
                Key: {
                    'userAddress': from,
                },
                UpdateExpression: "SET tokenIds = :tokenIds",
                ExpressionAttributeValues: {
                    ":tokenIds": existingTokenIdsFrom
                },
                ReturnValues: "UPDATED_NEW"
            };
            await dynamoDB.update(updateParamsFrom).promise();
            console.log("Successfully removed tokenId from old user address.");
        } catch (err) {
            console.error("Failed to remove tokenId from 'from' address. Error message:", err);
        }
    }

    try {
        const getParamsTo = {
            TableName: 'gNftTransferEvents',
            Key: {
                'userAddress': to,
            }
        };

        const resultTo = await dynamoDB.get(getParamsTo).promise();
        let existingTokenIdsTo = resultTo.Item && resultTo.Item.tokenIds ? resultTo.Item.tokenIds : [];
    
        if (!existingTokenIdsTo.includes(Number(tokenId))) {
            existingTokenIdsTo.push(Number(tokenId));
        }

        const updateParamsTo = {
            TableName: 'gNftTransferEvents',
            Key: {
                'userAddress': to,
            },
            UpdateExpression: "SET tokenIds = :tokenIds",
            ExpressionAttributeValues: {
                ":tokenIds": existingTokenIdsTo
            },
            ReturnValues: "UPDATED_NEW"
        };
    
        await dynamoDB.update(updateParamsTo).promise();
        console.log("Successfully added tokenId to new user address.");
    } catch (err) {
        console.error("Failed to add tokenId to 'to' address. Error message:", err);
    }
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
    const putParams = {
      TableName: 'LastProcessedBlock',
      Item: {
        'listenerId': listenerId,
        'blockNumber': blockNumber
      }
    };
  
    await dynamoDB.put(putParams).promise();
}

async function getPastEvents(provider) {
    let lastBlock = await getLastBlock();
    let contract = getContract(provider);
    let filter = contract.filters.Transfer();
  
    let events = await contract.queryFilter(filter, lastBlock + 1, 'latest');
    let newLastBlock = lastBlock;
  
    if (events.length > 0) {
      for (let event of events) {
        const {args, blockNumber} = event;
        await handleEvent(args.tokenId, args.to, args.from);
        if (blockNumber > newLastBlock) {
          newLastBlock = blockNumber;
        }
      }
    } else {
      newLastBlock = await provider.getBlockNumber();
    }
  
    if (newLastBlock > lastBlock) {
      await setLastBlock(newLastBlock);
    }
}

async function runHistoryDataScript(provider) {
    try {
        console.log('Starting to get past events...');
        await getPastEvents(provider);
        console.log('Past events fetched and processed.');
    } catch (error) {
        console.error('Error running history data script:', error);
    }
}

module.exports = {
    runHistoryDataScript
};
