import grpc from "@triton-one/yellowstone-grpc";
const Client = grpc.default;
const { CommitmentLevel } = grpc;

import { PublicKey } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { PumpFunTransactionFormatter } from "./utils/pf-transaction-formatter.js";
import anchorPkg from '@project-serum/anchor';
const { Idl } = anchorPkg;
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
import { readFile } from 'fs/promises';
const pumpFunIdl = JSON.parse(
  await readFile(new URL('./idls/pump_0.1.0.json', import.meta.url))
);
import { SolanaEventParser } from "./utils/event-parser.js";
import { bnLayoutFormatter } from "./utils/bn-layout-formatter.js";
import { humanizeTransactions } from "./custom/humanize-transactions.js";

import { printToFile } from "./custom/utils.js";
import dotenv from 'dotenv';
dotenv.config();

// import { RaydiumAmmParser } from "./parsers/raydium-amm-parser.js";
// const RAYDIUM_PUBLIC_KEY = RaydiumAmmParser.PROGRAM_ID;

const TXN_FORMATTER = new PumpFunTransactionFormatter();
const PUMP_FUN_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);
const PUMP_FUN_IX_PARSER = new SolanaParser([]);
PUMP_FUN_IX_PARSER.addParserFromIdl(
  PUMP_FUN_PROGRAM_ID.toBase58(),
  pumpFunIdl,
);
const PUMP_FUN_EVENT_PARSER = new SolanaEventParser([], console);
PUMP_FUN_EVENT_PARSER.addParserFromIdl(
  PUMP_FUN_PROGRAM_ID.toBase58(),
  pumpFunIdl,
);

async function handleStream(client, args) {
  // Subscribe for events
  const stream = await client.subscribe();

  // Create `error` / `end` handler
  const streamClosed = new Promise((resolve, reject) => {
    stream.on("error", (error) => {
      console.log("ERROR", error);
      reject(error);
      stream.end();
    });
    stream.on("end", () => {
      resolve();
    });
    stream.on("close", () => {
      resolve();
    });
  });

  // Handle updates
  stream.on("data", (data) => {
    if (data?.transaction) {
      const txn = TXN_FORMATTER.formTransactionFromJson(
        data.transaction,
        Date.now(),
      );
      const parsedTxn = decodePumpFunTxn(txn);
      if (!parsedTxn) return;

      // printToFile({ txn, parsedTxn });

      // if(parsedTxn.events.length > 1)
      //   console.log(parsedTxn.events, txn.transaction.signatures[0]);

      const analyzedTxn = humanizeTransactions(txn, parsedTxn, "pumpfun");

      if(analyzedTxn.swapEvents.length > 1)
        console.log(analyzedTxn);

      // console.log(
      //   new Date(),
      //   ":",
      //   `New transaction https://translator.shyft.to/tx/${txn.transaction.signatures[0]} \n`,
      //   JSON.stringify(parsedTxn, null, 2) + "\n",
      // );
    }
  });

  // Send subscribe request
  await new Promise((resolve, reject) => {
    stream.write(args, (err) => {
      if (err === null || err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    });
  }).catch((reason) => {
    console.error(reason);
    throw reason;
  });

  await streamClosed;
}

async function subscribeCommand(client, args) {
  while (true) {
    try {
      await handleStream(client, args);
    } catch (error) {
      console.error("Stream error, restarting in 1 second...", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

if (!process.env.ENDPOINT || !process.env.X_TOKEN) {
  console.error('Error: ENDPOINT and X_TOKEN environment variables are required');
  process.exit(1);
}

const client = new Client(
  process.env.ENDPOINT,
  process.env.X_TOKEN,
  undefined,
);

// const pumpfunCompletedBC = {
//   "account": [],
//   "filters": [
//     {
//       "memcmp": {
//         "offset": structure.offsetOf('complete').toString(), // Hack to filter for swapped. There is probably a better way to do this
//         "bytes" : Uint8Array.from([1])
//       }
//     }
//   ],
//   "owner": [pumpfun] // raydium program id to subscribe to
// }

const req = {
  accounts: {},
  slots: {},
  transactions: {
    pumpFun: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [PUMP_FUN_PROGRAM_ID.toBase58()],
      accountExclude: [],
      accountRequired: [],
    },
  },
  transactionsStatus: {},
  entry: {},
  blocks: {},
  blocksMeta: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CommitmentLevel.CONFIRMED,
};

subscribeCommand(client, req);

function decodePumpFunTxn(tx) {
  if (tx.meta?.err) return;

  const paredIxs = PUMP_FUN_IX_PARSER.parseTransactionData(
    tx.transaction.message,
    tx.meta.loadedAddresses,
  );

  const pumpFunIxs = paredIxs.filter((ix) =>
    ix.programId.equals(PUMP_FUN_PROGRAM_ID),
  );

  if (pumpFunIxs.length === 0) return;
  const events = PUMP_FUN_EVENT_PARSER.parseEvent(tx);
  const result = { instructions: pumpFunIxs, events };
  bnLayoutFormatter(result);
  return result;
}
