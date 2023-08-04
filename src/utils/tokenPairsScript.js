const ethers = require('ethers');
const AWS = require('aws-sdk');

const PROJ_ROOT = process.env.PROJ_ROOT;
const factoryAbi = require(`${PROJ_ROOT}/src/abis/factory_abi.json`);
const pairAbi = require(`${PROJ_ROOT}/src/abis/pair_abi.json`);
const config = require(`${PROJ_ROOT}/src/config/config.json`);
const factoryAddress = config.factoryAddress;

AWS.config.update({
    region: config.awsRegion,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function getAllPairAddresses(factoryContract) {
    const allPairsLength = await factoryContract.allPairsLength();
    const pairAddresses = [];

    for (let i = 0; i < allPairsLength; i++) {
        const pairAddress = await factoryContract.allPairs(i);
        pairAddresses.push(pairAddress);
    }

    return pairAddresses;
}

async function getTokenAddresses(pairAddress, provider) {
    const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    return {
        token0: token0,
        token1: token1
    };
}

async function storeTokenPairsToDB(pairAddresses, provider) {
    for (let i = 0; i < pairAddresses.length; i++) {
        const pairAddress = pairAddresses[i];
        const tokenAddresses = await getTokenAddresses(pairAddress, provider);

        const params = {
            TableName: 'TokenPairs',
            Item: {
                pairAddress: pairAddress,
                token0: tokenAddresses.token0,
                token1: tokenAddresses.token1
            }
        };

        await dynamodb.put(params).promise();
        console.log(`Stored token pair ${pairAddress} with token0 ${tokenAddresses.token0} and token1 ${tokenAddresses.token1}`);
    }
}

async function getStoredPairsCount() {
    const params = {
        TableName: 'TokenPairs'
    };

    const data = await dynamodb.scan(params).promise();
    return data.Items.length;
}

async function runTokenPairsScript(provider) {
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi, provider);
    try {
        const pairAddresses = await getAllPairAddresses(factoryContract);
        console.log('All pair addresses:', pairAddresses);

        const storedPairsCount = await getStoredPairsCount();
        console.log('Stored pairs count:', storedPairsCount);

        if (pairAddresses.length > storedPairsCount) {
            await storeTokenPairsToDB(pairAddresses, provider);
            console.log('Token pairs stored in the database.');
        } else {
            console.log('No new token pairs. No need to update the database.');
        }
    } catch (error) {
        console.error('Error running token pairs script:', error);
    }
}

module.exports = {
    runTokenPairsScript
};
