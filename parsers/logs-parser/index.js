import {
  // ParsedInstruction,
  parseLogs,
} from "@shyft-to/solana-transaction-parser";

import anchorPkg from '@project-serum/anchor';
const { Idl } = anchorPkg;

import { RaydiumAmmParser } from "../raydium-amm-parser.js";
import { RaydiumAmmLogsParser } from "./raydium-amm-logs-parser.js";

const RAYDIUM_AMM_PROGRAM_ID = RaydiumAmmParser.PROGRAM_ID.toBase58();

export function LogsParser() {
  this.raydiumAmmLogsParser = new RaydiumAmmLogsParser();

  this.parse = function(actions, logMessages) {
    if (!this.isValidIx(actions)) {
      return [];
    }

    const logs = parseLogs(logMessages);

    return actions
      .map((action, index) => {
        if ("info" in action) {
          return;
        } else {
          const programId = action.programId.toBase58();
          switch (programId) {
            case RAYDIUM_AMM_PROGRAM_ID: {
              return this.raydiumAmmLogsParser.parse(action, logs[index]);
            }
            default:
              return;
          }
        }
      })
      .filter(log => Boolean(log));
  }

  this.isValidIx = function(actions) {
    return actions.some(
      action => action.programId.toBase58() === RAYDIUM_AMM_PROGRAM_ID
    );
  }
}
