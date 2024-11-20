import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { utils } from '@project-serum/anchor';
import { struct, u16, u8 } from '@solana/buffer-layout';
import { u64, publicKey } from '@solana/buffer-layout-utils';
import { deserialize } from 'borsh';

const RaydiumInitializeArgsLayout = struct([
  u8('nonce'),
  u64('openTime')
]);

const RaydiumInitialize2ArgsLayout = struct([
  u8('nonce'),
  u64('openTime'),
  u64('initPcAmount'),
  u64('initCoinAmount')
]);

const MonitorStepArgsLayout = struct([
  u16('planOrderLimit'),
  u16('placeOrderLimit'),
  u16('cancelOrderLimit')
]);

const DepositArgsLayout = struct([
  u64('maxCoinAmount'),
  u64('maxPcAmount'),
  u64('baseSide')
]);

const WithdrawArgsLayout = struct([
  u64('amount')
]);

const SwapBaseInArgsLayout = struct([
  u64('amountIn'),
  u64('minimumAmountOut')
]);

const PreInitializeArgsLayout = struct([
  u8('nonce')
]);

const SwapBaseOutArgsLayout = struct([
  u64('maxAmountIn'),
  u64('amountOut')
]);

const AdminCancelOrdersArgsLayout = struct([
  u16('limit')
]);

const UpdateConfigAccountArgsLayout = struct([
  u8('param'),
  publicKey('owner')
]);

// Borsh schema classes and their definitions
class Fees {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class LastOrderDistance {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class NeedTakeAmounts {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class SetParamsArgs {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class SwapInstructionBaseIn {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class SwapInstructionBaseOut {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

class SimulateInfoArgs {
  constructor(properties) {
    Object.assign(this, properties);
  }
}

const SetParamsSchema = new Map([
  [SetParamsArgs, {
    kind: 'struct',
    fields: [
      ['param', 'u8'],
      ['value', { kind: 'option', type: 'u8' }],
      ['newPubkey', { kind: 'option', type: [32] }],
      ['fees', { kind: 'option', type: Fees }],
      ['lastOrderDistance', { kind: 'option', type: LastOrderDistance }],
      ['needTakeAmounts', { kind: 'option', type: NeedTakeAmounts }]
    ]
  }],
  [Fees, {
    kind: 'struct',
    fields: [
      ['minSeparateNumerator', 'u64'],
      ['minSeparateDenominator', 'u64'],
      ['tradeFeeNumerator', 'u64'],
      ['tradeFeeDenominator', 'u64'],
      ['pnlNumerator', 'u64'],
      ['pnlDenominator', 'u64'],
      ['swapFeeNumerator', 'u64'],
      ['swapFeeDenominator', 'u64']
    ]
  }],
  [LastOrderDistance, {
    kind: 'struct',
    fields: [
      ['lastOrderNumerator', 'u64'],
      ['lastOrderDenominator', 'u64']
    ]
  }],
  [NeedTakeAmounts, {
    kind: 'struct',
    fields: [
      ['needTakePc', 'u64'],
      ['needTakeCoin', 'u64']
    ]
  }]
]);

const SimulateInfoSchema = new Map([
  [SimulateInfoArgs, {
    kind: 'struct',
    fields: [
      ['param', 'u8'],
      ['swapBaseInValue', { kind: 'option', type: SwapInstructionBaseIn }],
      ['swapBaseOutValue', { kind: 'option', type: SwapInstructionBaseOut }]
    ]
  }],
  [SwapInstructionBaseIn, {
    kind: 'struct',
    fields: [
      ['amountIn', 'u64'],
      ['minimumAmountOut', 'u64']
    ]
  }],
  [SwapInstructionBaseOut, {
    kind: 'struct',
    fields: [
      ['maxAmountIn', 'u64'],
      ['amountOut', 'u64']
    ]
  }]
]);

export class RaydiumAmmParser {
  static PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

  parseInstruction(instruction) {
    const instructionData = instruction.data;
    const instructionType = u8().decode(instructionData.slice(0, 1));

    switch (instructionType) {
      case 0: return this.parseRaydiumInitializeIx(instruction);
      case 1: return this.parseRaydiumInitialize2Ix(instruction);
      case 2: return this.parseMonitorStepIx(instruction);
      case 3: return this.parseDepositIx(instruction);
      case 4: return this.parseWithdrawIx(instruction);
      case 5: return this.parseMigrateToOpenBookIx(instruction);
      case 6: return this.parseSetParamsIx(instruction);
      case 7: return this.parseWithdrawPnlIx(instruction);
      case 8: return this.parseWithdrawSrmIx(instruction);
      case 9: return this.parseSwapBaseInIx(instruction);
      case 10: return this.parsePreInitializeIx(instruction);
      case 11: return this.parseSwapBaseOutIx(instruction);
      case 12: return this.parseSimulateInfoIx(instruction);
      case 13: return this.parseAdminCancelOrdersIx(instruction);
      case 14: return this.parseCreateConfigAccountIx(instruction);
      case 15: return this.parseUpdateConfigAccountIx(instruction);
      default: return this.parseUnknownInstruction(instruction);
    }
  }

  parseRaydiumInitializeIx(instruction) {
    const accounts = instruction.keys;
    const args = RaydiumInitializeArgsLayout.decode(instruction.data.slice(1));

    return {
      name: 'initialize',
      accounts: accounts.map((account, index) => {
        const accountMap = {
          3: 'amm',
          4: 'ammAuthority',
          5: 'ammOpenOrders',
          6: 'lpMintAddress',
          7: 'coinMintAddress',
          8: 'pcMintAddress',
          9: 'poolCoinTokenAccount',
          10: 'poolPcTokenAccount',
          11: 'poolWithdrawQueue',
          12: 'poolTargetOrdersAccount',
          13: 'userLpTokenAccount',
          14: 'poolTempLpTokenAccount',
          16: 'serumMarket',
          17: 'userWallet'
        };
        return {
          ...account,
          name: accountMap[index] || account.name
        };
      }),
      args: {
        nonce: args.nonce,
        openTime: args.openTime.toString()
      },
      programId: instruction.programId
    };
  }

  parseSwapBaseInIx(instruction) {
    const accounts = instruction.keys;
    const args = SwapBaseInArgsLayout.decode(instruction.data.slice(1));

    return {
      name: 'swapBaseIn',
      accounts: accounts.map((account, index) => {
        const accountMap = {
          1: 'amm',
          2: 'ammAuthority',
          3: 'ammOpenOrders',
          4: 'ammTargetOrders',
          5: 'poolCoinTokenAccount',
          6: 'poolPcTokenAccount',
          8: 'serumMarket',
          9: 'serumBids',
          10: 'serumAsks',
          11: 'serumEventQueue',
          12: 'serumCoinVaultAccount',
          13: 'serumPcVaultAccount',
          14: 'serumVaultSigner',
          15: 'userSourceTokenAccount',
          16: 'userDestinationTokenAccount',
          17: 'userSourceOwner'
        };
        return {
          ...account,
          name: accountMap[index] || account.name
        };
      }),
      args: {
        amountIn: args.amountIn.toString(),
        minimumAmountOut: args.minimumAmountOut.toString()
      },
      programId: instruction.programId
    };
  }

  parseSwapBaseOutIx(instruction) {
    const accounts = instruction.keys;
    const args = SwapBaseOutArgsLayout.decode(instruction.data.slice(1));

    return {
      name: 'swapBaseOut',
      accounts: accounts.map((account, index) => {
        const accountMap = {
          1: 'amm',
          2: 'ammAuthority',
          3: 'ammOpenOrders',
          4: 'ammTargetOrders',
          5: 'poolCoinTokenAccount',
          6: 'poolPcTokenAccount',
          8: 'serumMarket',
          9: 'serumBids',
          10: 'serumAsks',
          11: 'serumEventQueue',
          12: 'serumCoinVaultAccount',
          13: 'serumPcVaultAccount',
          14: 'serumVaultSigner',
          15: 'userSourceTokenAccount',
          16: 'userDestinationTokenAccount',
          17: 'userSourceOwner'
        };
        return {
          ...account,
          name: accountMap[index] || account.name
        };
      }),
      args: {
        maxAmountIn: args.maxAmountIn.toString(),
        amountOut: args.amountOut.toString()
      },
      programId: instruction.programId
    };
  }

  parseUnknownInstruction(instruction) {
    return {
      name: 'unknown',
      accounts: instruction.keys,
      args: {
        unknown: utils.bytes.bs58.encode(instruction.data)
      },
      programId: instruction.programId
    };
  }
}
