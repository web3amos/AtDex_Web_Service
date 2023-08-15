const axios = require('axios');

async function getPairPrice(inputTokenSymbol, outputTokenSymbol) {
  const url = `foo:bar/`;
  try {
    // const response = await axios.get(url);
    // return response.data[inputTokenSymbol.toLowerCase()].usd;
    console.log('getting pair price input token and output token:',inputTokenSymbol,outputTokenSymbol);
    return 1;
  } catch (error) {
    console.error('Error fetching pair price:', error);
    return null;
  }
}

module.exports = {
  getPairPrice,
};
