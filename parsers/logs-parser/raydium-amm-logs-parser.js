import anchorPkg from '@project-serum/anchor';
const { Idl } = anchorPkg;
// import {
//   LogContext,
//   ParsedInstruction,
// } from "@shyft-to/solana-transaction-parser";
import { struct, u8 } from "@solana/buffer-layout";
import { u64, u128, publicKey } from "@solana/buffer-layout-utils";
// import { PublicKey } from "@solana/web3.js";
// import { LogsParser } from "./index.js";

const LOG_TO_INSTRUCTION_MAP = {
  Init: "initialize",
  Init2: "initialize2",
  Deposit: "deposit",
  Withdraw: "withdraw",
  SwapBaseIn: "swapBaseIn",
  SwapBaseOut: "SwapBaseOut",
};

const InitLogLayout = struct([
  u8("logType"),
  u64("time"),
  u8("pcDecimals"),
  u8("coinDecimals"),
  u64("pcLotSize"),
  u64("coinLotSize"),
  u64("pcAmount"),
  u64("coinAmount"),
  publicKey("market"),
]);

const DepositLogLayout = struct([
  u8("logType"),
  u64("maxCoin"),
  u64("maxPc"),
  u64("base"),
  u64("poolCoin"),
  u64("poolPc"),
  u64("pcAmount"),
  u64("poolLp"),
  u128("calcPnlX"),
  u128("calcPnlY"),
  u64("deductCoin"),
  u64("deductPc"),
  u64("mintLp"),
]);

const WithdrawLogLayout = struct([
  u8("logType"),
  u64("withdrawLp"),
  u64("userLp"),
  u64("poolCoin"),
  u64("poolPc"),
  u64("poolLp"),
  u128("calcPnlX"),
  u128("calcPnlY"),
  u64("outCoin"),
  u64("outPc"),
]);

const SwapBaseInLogLayout = struct([
  u8("logType"),
  u64("amountIn"),
  u64("minimumOut"),
  u64("direction"),
  u64("userSource"),
  u64("poolCoin"),
  u64("poolPc"),
  u64("outAmount"),
]);

const SwapBaseOutLogLayout = struct([
  u8("logType"),
  u64("maxIn"),
  u64("amountOut"),
  u64("direction"),
  u64("userSource"),
  u64("poolCoin"),
  u64("poolPc"),
  u64("directIn"),
]);

export function RaydiumAmmLogsParser() {
  this.parse = function(action, log) {
    if (!log) {
      return;
    }
    const instructionLog = log.logMessages[0]?.split(" ").at(-1);
    const instruction = LOG_TO_INSTRUCTION_MAP[instructionLog];

    if (instruction) {
      action.name = instruction;
    }

    let event;
    switch (action.name) {
      case "initialize":
      case "initialize2":
      case "deposit":
      case "withdraw":
      case "swapBaseIn":
      case "swapBaseOut": {
        try {
          const rayLog = log.logMessages.at(-1);
          const base64Log = rayLog.replace("ray_log: ", "");
          const raydiumEventData = Buffer.from(base64Log, "base64");

          const discriminator = u8().decode(raydiumEventData);
          switch (discriminator) {
            case 0: {
              const logData = InitLogLayout.decode(raydiumEventData);
              event = { name: "init", data: logData };
              break;
            }
            case 1: {
              const logData = DepositLogLayout.decode(raydiumEventData);
              event = { name: "deposit", data: logData };
              break;
            }
            case 2: {
              const logData = WithdrawLogLayout.decode(raydiumEventData);
              event = { name: "withdraw", data: logData };
              break;
            }
            case 3: {
              const logData = SwapBaseInLogLayout.decode(raydiumEventData);
              event = { name: "swapBaseIn", data: logData };
              break;
            }
            case 4: {
              const logData = SwapBaseOutLogLayout.decode(raydiumEventData);
              event = { name: "swapBaseOut", data: logData };
              break;
            }
          }
          return event;
        } catch (error) {
          console.error({
            message: "raydiumAmmlogParsingErr",
            error,
          });
          return;
        }
      }
      default:
        return;
    }
  }
}
