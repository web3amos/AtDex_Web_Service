const ethers = require('ethers');
const AWS = require('aws-sdk');

const PROJ_ROOT = process.env.PROJ_ROOT;
const config = require(`${PROJ_ROOT}/src/config/config.json`);
const gNftAbi = require(`${PROJ_ROOT}/src/abis/gNft_abi.json`);
const address = config.gNftAddress;


AWS.config.update({
  region: config.awsRegion,
});
const dynamoDB = new AWS.DynamoDB.DocumentClient();

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
        } catch (err) {
            console.error("Gnft handleEvent", err);
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
    } catch (err) {
        console.error("Gnft handleEvent", err);
    }
}
async function start(provider) {
    const contract = new ethers.Contract(address, gNftAbi, provider);
    provider.on("*", (result) => {
        console.log(result);
    });
    contract.on("Transfer", (from, to, tokenId) => { 
        console.log('xxxxx_____gNft____xxxxxxx');
        handleEvent(tokenId, to, from)
            .catch(err => {
                console.error('Error handling event:', err);
            });
    });
}

module.exports = {
  start
};
