import "dotenv/config";
import grpc from "@triton-one/yellowstone-grpc";
const Client = grpc.default;
const {
  CommitmentLevel,
  // SubscribeRequestAccountsDataSlice,
  // SubscribeRequestFilterAccounts,
  // SubscribeRequestFilterBlocks,
  // SubscribeRequestFilterBlocksMeta,
  // SubscribeRequestFilterEntry,
  // SubscribeRequestFilterSlots,
  // SubscribeRequestFilterTransactions,
} = grpc;
import anchorPkg from '@project-serum/anchor';
const { Idl } = anchorPkg;
// import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
// import { VersionedTransactionResponse } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import { PublicKey } from "@solana/web3.js";

import { RaydiumTransactionFormatter } from "./utils/raydium-transaction-formatter.js";
import { RaydiumAmmParser } from "./parsers/raydium-amm-parser.js";
import { LogsParser } from "./parsers/logs-parser/index.js";
import { bnLayoutFormatter } from "./utils/bn-layout-formatter.js";
import { humanizeTransactions } from "./custom/humanize-transactions.js";

const PUMP_FUN_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

const RAYDIUM_PUBLIC_KEY = RaydiumAmmParser.PROGRAM_ID;
const TXN_FORMATTER = new RaydiumTransactionFormatter();
const raydiumAmmParser = new RaydiumAmmParser();
const IX_PARSER = new SolanaParser([]);
IX_PARSER.addParser(
  RaydiumAmmParser.PROGRAM_ID,
  raydiumAmmParser.parseInstruction.bind(raydiumAmmParser),
);
const LOGS_PARSER = new LogsParser();

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

  let parsedTxnArr = [];

  // Handle updates
  stream.on("data", (data) => {

    if (data?.transaction) {
      const txn = TXN_FORMATTER.formTransactionFromJson(
        data.transaction,
        Date.now(),
      );
      const parsedTxn = decodeRaydiumTxn(txn);
      if (!parsedTxn) return;

      const analyzedTxn = humanizeTransactions(txn, parsedTxn);
      console.log(analyzedTxn);

      // if(analyzedTxn?.swapEvents[0]?.token_add == "3K4q4zLg4p2B5vD4a6rA79N4nswE8GKb1dEpVCvdpump") {
      //   console.log(analyzedTxn);
      // }

      // if(analyzedTxn?.swapEvents?.length > 1)

      // if(analyzedTxn.signers?.length > 1 && analyzedTxn.signers[0] != analyzedTxn.signers[1]) {
      //   printToFile({ rawTxn: txn, parsedTxn });
      // }

      // parsedTxnArr.push({ rawTxn: txn, parsedTxn });
      // if(parsedTxnArr.length == 8) {
      //   printToFile(parsedTxnArr);
      // }

      // console.log("\x1b[32m"+txn.transaction.signatures[0]+"\x1b[0m");
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

const client = new Client(
  process.env.ENDPOINT,
  process.env.X_TOKEN,
  undefined,
);

const raydiumNewPools = {
  "account": [],
  "filters": [
    {
      "memcmp": {
        "offset": LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint').toString(), // Filter for only tokens paired with SOL
        "base58": "So11111111111111111111111111111111111111112"
      }
    },
    {
      "memcmp": {
        "offset": LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId').toString(), // Filter for only Raydium markets that contain references to Serum
        "base58": "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
      }
    },
    {
      "memcmp": {
        "offset": LIQUIDITY_STATE_LAYOUT_V4.offsetOf('swapQuoteInAmount').toString(), // Hack to filter for only new tokens. There is probably a better way to do this
        "bytes": Uint8Array.from([0])
      }
      },
    {
      "memcmp": {
        "offset": LIQUIDITY_STATE_LAYOUT_V4.offsetOf('swapBaseOutAmount').toString(), // Hack to filter for only new tokens. There is probably a better way to do this
        "bytes": Uint8Array.from([0])
      }
    }
  ],
  "owner": ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] // raydium program id to subscribe to
}

subscribeCommand(client, {
  accounts: {
    // raydium: raydiumNewPools
  },
  slots: {},
  transactions: {
    raydiumLiquidityPoolV4: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [RAYDIUM_PUBLIC_KEY.toBase58(), PUMP_FUN_PROGRAM_ID.toBase58()],
      accountExclude: [],
      accountRequired: [],
    },
    // pumpFun: {
    //   vote: false,
    //   failed: false,
    //   signature: undefined,
    //   accountInclude: [PUMP_FUN_PROGRAM_ID.toBase58()],
    //   accountExclude: [],
    //   accountRequired: [],
    // },
  },
  transactionsStatus: {},
  entry: {},
  blocks: {},
  blocksMeta: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CommitmentLevel.PROCESSED,
});

function decodeRaydiumTxn(tx) {
  if (tx.meta?.err) return;

  const parsedIxs = IX_PARSER.parseTransactionWithInnerInstructions(tx);

  const programIxs = parsedIxs.filter((ix) =>
    ix.programId.equals(RAYDIUM_PUBLIC_KEY),
  );

  if (programIxs.length === 0) return;
  const LogsEvent = LOGS_PARSER.parse(parsedIxs, tx.meta.logMessages);
  const result = { instructions: parsedIxs, events: LogsEvent };
  bnLayoutFormatter(result);
  return result;
}
