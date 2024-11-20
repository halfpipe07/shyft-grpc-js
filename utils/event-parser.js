import {
  Message,
  MessageV0,
  PublicKey,
} from "@solana/web3.js";
import { BorshCoder, EventParser } from "@project-serum/anchor";
import pkg from 'lodash';
const { intersection } = pkg;

export class SolanaEventParser {
  constructor(programInfos, logger) {
    this.eventDecoders = new Map();
    for (const programInfo of programInfos) {
      this.addParserFromIdl(
        new PublicKey(programInfo.programId),
        programInfo.idl,
      );
    }
  }

  addParserFromIdl(programId, idl) {
    if (idl?.events) {
      try {
        const coder = new BorshCoder(idl);
        this.eventDecoders.set(programId, coder);
      } catch (e) {
        this.logger.error({
          message: "SolanaEventParser.addParserFromIdl_error",
          data: { programId },
          error: e,
        });
      }
    }
  }

  removeParser(programId) {
    this.eventDecoders.delete(programId);
  }

  parseEvent(txn) {
    try {
      let programIds = [];
      if (
        txn?.transaction.message instanceof Message ||
        txn?.transaction.message instanceof MessageV0
      ) {
        const accountKeys = txn.transaction.message.staticAccountKeys;
        txn.transaction.message.compiledInstructions.forEach((instruction) => {
          const programId = accountKeys[instruction.programIdIndex];
          if (programId) {
            programIds.push(programId.toBase58());
          }
        });
      } else {
        txn.transaction.message.instructions.forEach((instruction) => {
          programIds.push(instruction.programId.toBase58());
        });
      }
      const availableProgramIds = Array.from(this.eventDecoders.keys()).map(
        (programId) => programId.toString(),
      );
      const commonProgramIds = intersection(availableProgramIds, programIds);
      if (commonProgramIds.length) {
        const events = [];
        for (const programId of commonProgramIds) {
          const eventCoder = this.eventDecoders.get(programId);
          if (!eventCoder) {
            continue;
          }

          const eventParser = new EventParser(
            new PublicKey(programId),
            eventCoder,
          );
          const eventsArray = Array.from(
            eventParser.parseLogs(txn?.meta?.logMessages)
          );
          events.push(...eventsArray);
        }
        return events;
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  parseProgramLogMessages(programId, rawLogs) {
    try {
      const eventCoder = this.eventDecoders.get(programId);
      if (!eventCoder) {
        return [];
      }
      const eventParser = new EventParser(new PublicKey(programId), eventCoder);
      return Array.from(eventParser.parseLogs(rawLogs));
    } catch (err) {
      this.logger.error({
        message: "SolanaEventParser.parseProgramLogMessages_error",
        data: { programId, rawLogs },
        error: err,
      });
      return [];
    }
  }

  getEventCoder(programId) {
    return this.eventDecoders.get(programId);
  }
}
