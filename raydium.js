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
import { RaydiumTransactionFormatter } from "./utils/raydium-transaction-formatter.js";
import { RaydiumAmmParser } from "./parsers/raydium-amm-parser.js";
import { LogsParser } from "./parsers/logs-parser/index.js";
import { bnLayoutFormatter } from "./utils/bn-layout-formatter.js";

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

  // Handle updates
  stream.on("data", (data) => {
    if (data?.transaction) {
      const txn = TXN_FORMATTER.formTransactionFromJson(
        data.transaction,
        Date.now(),
      );
      const parsedTxn = decodeRaydiumTxn(txn);

      if (!parsedTxn) return;

      console.log(
        // new Date(),
        // ":",
        // `New transaction https://translator.shyft.to/tx/${txn.transaction.signatures[0]} \n`,
        // JSON.stringify(parsedTxn, null, 2) + "\n",
        txn.transaction.signatures[0],
      );
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

const req = {
  accounts: {},
  slots: {},
  transactions: {
    raydiumLiquidityPoolV4: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [RAYDIUM_PUBLIC_KEY.toBase58()],
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
  commitment: CommitmentLevel.PROCESSED,
};

subscribeCommand(client, req);

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
