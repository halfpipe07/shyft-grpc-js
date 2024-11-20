import {
  Message,
  MessageV0,
  PublicKey,
} from "@solana/web3.js";
import { utils } from "@project-serum/anchor";

export function TransactionFormatter() {
  this.formTransactionFromJson = function(data, time) {
    const rawTx = data["transaction"];

    const slot = data.slot;
    const version = rawTx.transaction.message.versioned ? 0 : "legacy";

    const meta = this.formMeta(rawTx.meta);
    const signatures = rawTx.transaction.signatures.map((s) =>
      utils.bytes.bs58.encode(s),
    );

    const message = this.formTxnMessage(rawTx.transaction.message);

    return {
      slot,
      version,
      blockTime: time,
      meta,
      transaction: {
        signatures,
        message,
      },
    };
  }

  this.formTxnMessage = function(message) {
    if (!message.versioned) {
      return new Message({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts:
            message.header.numReadonlyUnsignedAccounts,
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64"),
        ),
        accountKeys: message.accountKeys?.map((d) =>
          Buffer.from(d, "base64"),
        ),
        instructions: message.instructions.map(
          ({
            data,
            programIdIndex,
            accounts,
          }) => ({
            programIdIndex: programIdIndex,
            accounts: [...accounts] || [],
            data: utils.bytes.bs58.encode(Buffer.from(data || "", "base64")),
          }),
        ),
      });
    } else {
      return new MessageV0({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts:
            message.header.numReadonlyUnsignedAccounts,
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64"),
        ),
        staticAccountKeys: message.accountKeys.map(
          (k) => new PublicKey(Buffer.from(k, "base64")),
        ),
        compiledInstructions: message.instructions.map(
          ({
            programIdIndex,
            accounts,
            data,
          }) => ({
            programIdIndex: programIdIndex,
            accountKeyIndexes: [...accounts] || [],
            data: Uint8Array.from(Buffer.from(data || "", "base64")),
          }),
        ),
        addressTableLookups:
          message.addressTableLookups?.map(
            ({
              accountKey,
              writableIndexes,
              readonlyIndexes,
            }) => ({
              writableIndexes: writableIndexes || [],
              readonlyIndexes: readonlyIndexes || [],
              accountKey: new PublicKey(Buffer.from(accountKey, "base64")),
            }),
          ) || [],
      });
    }
  }

  this.formMeta = function(meta) {
    return {
      err: meta.errorInfo ? { err: meta.errorInfo } : null,
      fee: meta.fee,
      preBalances: meta.preBalances,
      postBalances: meta.postBalances,
      preTokenBalances: meta.preTokenBalances || [],
      postTokenBalances: meta.postTokenBalances || [],
      logMessages: meta.logMessages || [],
      loadedAddresses:
        meta.loadedWritableAddresses || meta.loadedReadonlyAddresses
          ? {
              writable:
                meta.loadedWritableAddresses?.map(
                  (address) =>
                    new PublicKey(Buffer.from(address, "base64")),
                ) || [],
              readonly:
                meta.loadedReadonlyAddresses?.map(
                  (address) =>
                    new PublicKey(Buffer.from(address, "base64")),
                ) || [],
            }
          : undefined,
          innerInstructions:
            meta.innerInstructions?.map(
              i => ({
                index: i.index || 0,
                instructions: i.instructions.map(instruction => ({
                  programIdIndex: instruction.programIdIndex,
                  accounts: [...instruction.accounts] || [],
                  data: utils.bytes.bs58.encode(
                    Buffer.from(instruction.data || "", "base64"),
                  ),
                })),
              }),
            ) || [],
    };
  }
}
