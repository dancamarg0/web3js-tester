const fs = require('fs');
const nodeFetch = require('node-fetch');
const { Connection, PublicKey } = require('@solana/web3.js');
const { HttpsAgent } = require('agentkeepalive');

const connectionString = "https://solana_endpoint.com";

const httpAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 25,
  freeSocketTimeout: 19000,
  timeout: 0,
});

const connection = new Connection(connectionString, {
  fetch: async (url: RequestInfo, init?: RequestInit) => { // custom fetch function around the connection object to override web3 default one
    const customInit: RequestInit = {
      ...(init as RequestInit), // Cast init to RequestInit type
      headers: {
        ...(init?.headers as HeadersInit), // Cast headers to HeadersInit type
          // Add any additional headers here if needed
      },
    };
    // Type assertion for the 'compress' property
    (customInit as any).compress = true;
    const response = await nodeFetch(url, customInit, { agent: httpAgent }); // Use the custom fetch function
    // You can modify the response if necessary before returning it
    return response;
  },
});

async function fetchAccountInfoBatch(keys: string[]) {
  const batchSize = 100;
  const batches = Math.ceil(keys.length / batchSize);

  for (let batchNumber = 0; batchNumber < batches; batchNumber++) {
    const batchKeys = keys.slice(batchNumber * batchSize, (batchNumber + 1) * batchSize);
    const promises = batchKeys.map((key: string) => fetchWithRetry(() => connection.getAccountInfo(new PublicKey(key))));
    const results = await Promise.all(promises);
    console.log(`Batch ${batchNumber + 1}: Fetched ${results.length} accounts.`);
  }
}

async function fetchWithRetry(fetchFunction: () => Promise<any>, maxRetries = 3) { // Add type annotation for fetchFunction
    let retryCount = 0;
    while (true) {
      try {
        return await fetchFunction();
      } catch (error: any) {
        // Retry up to maxRetries for any error
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`Request failed (attempt ${retryCount} of ${maxRetries}). Retrying...`);
          console.warn('Error Message:', error.message); // Log the error message
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
        } else {
          // If maxRetries reached, throw the error
          throw error;
        }
      }
    }
  }

async function main() {
  try {
    while (true) {
      // Read the list of keys from the file (one key per line)
      const keys = fs.readFileSync('keys.txt', 'utf-8').split('\n').filter(Boolean);

      // Fetch accounts in batches with retry
      await fetchAccountInfoBatch(keys);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();



