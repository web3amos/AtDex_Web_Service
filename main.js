PROJ_ROOT=process.env.PROJ_ROOT
const logger = require(`${PROJ_ROOT}/src/winston`);
const ethers = require('ethers');
const cron = require('node-cron');
const gNftScript  = require(`${PROJ_ROOT}/src/utils/gNftScript.js`);
const spNftScript  = require(`${PROJ_ROOT}/src/utils/spNftScript.js`);
const SwapListener = require(`${PROJ_ROOT}/src/swapListener`);
const AddLiqListener = require(`${PROJ_ROOT}/src/addLiqListener`);
const PairCreatedListener = require(`${PROJ_ROOT}/src/pairCreatedListener`)
const tokenPairsScript = require(`${PROJ_ROOT}/src/utils/tokenPairsScript.js`);
const BasePoolListener = require(`${PROJ_ROOT}/src/basePoolListener.js`)
const GNftListener = require(`${PROJ_ROOT}/src/gNftListener.js`)
const AtCoreRouterListener = require(`${PROJ_ROOT}/src/atCoreRouterListener.js`)
const EsArrListener = require(`${PROJ_ROOT}/src/esArrListener.js`)

const providerUrl = 'wss://testnet.era.zksync.dev/ws';
let provider;
let reconnectTimeout = null;

const EXPECTED_PONG_BACK = 15000;  
const KEEP_ALIVE_CHECK_INTERVAL = 7500;  

async function getSpNftHistoryData() {
  try {
     await spNftScript.runHistoryDataScript(provider);

    cron.schedule('0 * * * *', async () => {
        console.log('Running SpNft History Data Script every 60 minutes');
        await spNftScript.runHistoryDataScript(provider);
    }, {
        scheduled: true,
        timezone: "America/Los_Angeles"
    });

  } catch (error) {
    console.error("Error connecting to the provider:", error);
  }
}

async function getGNftHistoryData() {
  try {
     await gNftScript.runHistoryDataScript(provider);

    cron.schedule('0 * * * *', async () => {
        console.log('Running GNft History Data Script every 60 minutes');
        await gNftScript.runHistoryDataScript(provider);
    }, {
        scheduled: true,
        timezone: "America/Los_Angeles"
    });

  } catch (error) {
    console.error("Error connecting to the provider:", error);
  }
}

async function startSwapListener() {
  logger.info('SwapListener is starting');
  try {
    await SwapListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in SwapListener.start: ${err}`);
    console.error("Error occurred in SwapListener.start:", err);
    setTimeout(startSwapListener, 30000);  // 30 seconds
  }
}

async function startEsArrListener(){
  logger.info('EsArrListener is starting');
  try {
    await EsArrListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in SwapListener.start: ${err}`);
    console.error("Error occurred in SwapListener.start:", err);
    setTimeout(startEsArrListener, 30000);  // 30 seconds
  }
}

async function startAtCoreRouterListener() {
  logger.info('atCoreRouterListener is starting');
  try {
    await AtCoreRouterListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in AtCoreRouterListener.start: ${err}`);
    console.error("Error occurred in AtCoreRouterListener.start:", err);
    setTimeout(startAtCoreRouterListener, 30000);  // 30 seconds
  }
}

async function startAddLiqListener() {
  logger.info('AddLiqListener is starting');
  try {
    await AddLiqListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in AddLiqListener.start: ${err}`);
    console.error("Error occurred in AddLiqListener.start:", err);
    setTimeout(startAddLiqListener, 30000);  // 30 seconds
  }
}

async function startPairCreatedListener() {
  try {
    await PairCreatedListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in AddLiqListener.start: ${err}`);
    console.error("Error occurred in AddLiqListener.start:", err);
    setTimeout(startAddLiqListener, 40000);  // 40 seconds
  }
}

async function startBasePoolListener() {
  try {
    await BasePoolListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in BasePoolListener.start: ${err}`);
    console.error("Error occurred in BasePoolListener.start:", err);
    setTimeout(startBasePoolListener, 60000);  // 60 seconds
  }
}

async function startGNftListener() {
  try {
    await GNftListener.start(provider);
  } catch (err) {
    logger.error(`Error occurred in GNftListener.start: ${err}`);
    console.error("Error occurred in GNftListener.start:", err);
    setTimeout(GNftListener, 60000);  // 60 seconds
  }
}

async function runTokenPairsScript() {
  try {
    await tokenPairsScript.runTokenPairsScript(provider);
    cron.schedule('*/30 * * * *', async () => {
        try {
            await tokenPairsScript.runTokenPairsScript(provider);
        } catch (error) {
            console.error('Error running token pairs script:', error);
        }
    });
} catch (error) {
    console.error('Error running token pairs script immediately:', error);
}
}

async function startAllListeners() {
  getSpNftHistoryData();
  getGNftHistoryData();
  runTokenPairsScript();
  startGNftListener();
  startPairCreatedListener();
  startSwapListener();
  startAtCoreRouterListener();
  startAddLiqListener();
  startBasePoolListener();
  startEsArrListener();
  
}

function connectToProvider() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (provider) {
    provider.removeAllListeners();
  }

  provider = new ethers.providers.WebSocketProvider(providerUrl);

  let pingTimeout = null;

  provider._websocket.on('open', () => {
    console.log("WebSocket connection established successfully.");
    startAllListeners();

    pingTimeout = setInterval(() => {
      console.log('Checking if the connection is alive, sending a ping');
      provider._websocket.ping();
      
      reconnectTimeout = setTimeout(() => {
        console.log("WebSocket connection not responding, trying to reconnect...");
        provider._websocket.terminate();
        connectToProvider();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);
  });

  provider._websocket.on('close', () => {
    console.log("WebSocket connection closed.");
    clearTimeout(reconnectTimeout);
    clearTimeout(pingTimeout);
    connectToProvider();
  });

  provider._websocket.on('pong', () => {
    console.log('Received pong, so connection is alive, clearing the timeout');
    clearTimeout(reconnectTimeout);
  });

  provider._websocket.on('error', (err) => {
    console.error("WebSocket connection error occurred:", err);
    clearTimeout(reconnectTimeout);
    clearTimeout(pingTimeout);
    connectToProvider();
  });
}

connectToProvider();
