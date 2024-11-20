import {
  ParsedInstruction,
  parseLogs,
} from "@shyft-to/solana-transaction-parser";
import { Idl } from "@project-serum/anchor";
import { RaydiumAmmParser } from "../raydium-amm-parser";
import { RaydiumAmmLogsParser } from "./raydium-amm-logs-parser";

const RAYDIUM_AMM_PROGRAM_ID = RaydiumAmmParser.PROGRAM_ID.toBase58();

function LogsParser() {
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

module.exports = {
  LogsParser
};
