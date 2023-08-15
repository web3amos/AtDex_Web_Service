const ethers = require('ethers');
const PROJ_ROOT = process.env.PROJ_ROOT;
const config = require(`${PROJ_ROOT}/src/config/config.json`); 
const atDexRouterAbi = require(`${PROJ_ROOT}/src/abis/atCoreRouter_abi.json`);
const atDexRouterAddress = config.atDexRouterAddress;


async function handleSwapEvent(...args) {
  const event = args[args.length - 1];
  console.log(JSON.stringify(event, null, 2));
}

setInterval(() => {
  swapStorage = {};
}, 10 * 60 * 1000);

async function start(provider) {
  console.log('xxxxxxxxxxx atdex router');
  const pairContract = new ethers.Contract(atDexRouterAddress, atDexRouterAbi, provider);
  pairContract.on('ForEthSwap', handleSwapEvent);
}

module.exports = {
  start
};