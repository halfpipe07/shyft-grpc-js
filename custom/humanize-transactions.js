import { swapInstruction, SwapMath } from "@raydium-io/raydium-sdk";

const SPL_MINT = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const RAYDIUM_AUTHORITY_V4 = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';

function findBalanceChanges(preBalances, postBalances, ignoreAccount = null) {
    const changes = [];

    for (const pre of preBalances) {
        const post = postBalances.find(p =>
            p.accountIndex === pre.accountIndex &&
            p.mint === pre.mint
        );

        if (post && pre.owner !== ignoreAccount) {
        // if (post && pre.owner !== ignoreAccount && pre.owner == RAYDIUM_AUTHORITY_V4) {
            const change = {
                mint: pre.mint,
                owner: pre.owner,
                preBal: parseFloat(pre.uiTokenAmount.uiAmountString),
                postBal: parseFloat(post.uiTokenAmount.uiAmountString),
                diff: parseFloat(post.uiTokenAmount.uiAmountString) - parseFloat(pre.uiTokenAmount.uiAmountString)
            };
            changes.push(change);
        }
    }

    return changes;
}

// for debugging
function printEventMap(rawTxn, parsedTxn, mode) {
  const excludedEvents = ["createAssociatedTokenAccount",
    "createAccount",
    "initializeAccount3",
    "unknown",
    "swapBaseIn",
    "swapBaseOut",
    "transfer",
    "closeAccount",
    "createAccountWithSeed",
    "initializeAccount",
    "syncNative",
    "transferChecked"];

  parsedTxn?.instructions?.map(x => {
    if(!excludedEvents.includes(x.name)) {
      if (mode == 1) {
        console.log(`\x1b[34m${x.name}\x1b[0m`);
      } else {
        console.log(`\x1b[34m${x.name}\x1b[0m => ${x.accounts?.map(y => y.name).join(',')}`);
      }
    }
  });

  console.log("\x1b[32m"+rawTxn.transaction.signatures[0]+"\x1b[0m");
}

function parseRaydiumSwapEvent(changes, swapInstruction, token_add) {
  let result = {
    swapEventName: swapInstruction?.name,
    token_add,
    dir: '',               // 'buy' or 'sell'
    lpAddress: '',          // liquidity pool address
    startingTokenBal: 0,    // starting token balance
    endingTokenBal: 0,      // ending token balance
    startingSolBal: 0,      // starting SOL balance
    endingSolBal: 0,        // ending SOL balance
    solAmount: 0,           // SOL amount involved
    tokenAmount: 0,         // token amount involved
    owner: ''               // transaction owner
  }

  // -------- OWNER --------
  const ownerTypes = ["payer", "userSourceOwner", "owner", "authority", "userOwner", "feeAccount", "sender", "fundingAccount", "wallet"];
  let signerAccounts = swapInstruction.accounts.filter(acc => acc.isSigner === true);

  if(signerAccounts.length > 1) {
    signerAccounts = signerAccounts.filter(acc => ownerTypes.includes(acc.name));
  }

  if(!!signerAccounts.length) result.owner = signerAccounts[0].pubkey;

  // --------- LP ADDRESS --------
  const lp = swapInstruction.accounts.find(acc =>
      acc.pubkey !== WSOL_MINT &&
      acc.pubkey !== SPL_MINT &&
      acc.name?.toLowerCase().includes('amm')
  )?.pubkey;

  if (lp) {
      result.lpAddress = lp;
  }

  // ---------- BALANCES --------
  const wsolChange = changes.find(c => c.mint === WSOL_MINT);
  const tokenChange = changes.find(c => c.mint === token_add);

  if (tokenChange) {
      result.startingTokenBal = tokenChange.preBal;
      result.endingTokenBal = tokenChange.postBal;
      result.tokenAmount = Math.abs(tokenChange.diff);
  }

  if (wsolChange) {
      result.startingSolBal = wsolChange.preBal;
      result.endingSolBal = wsolChange.postBal;
      result.solAmount = Math.abs(wsolChange.diff);
  }

  // Determine direction based on WSOL balance change
  // from perspective of the pool, WSOL increased means buy
  if (wsolChange) {
      result.dir = wsolChange.diff > 0 ? 'buy' : 'sell';
  }

  return result;
}

function parsePumpfunEvent(rawTxn, tradeEvent, swapInstruction) {
  let result = {
    swapEventName: swapInstruction?.name,
    token_add: '',
    dir: '',               // 'buy' or 'sell'
    lpAddress: '',          // liquidity pool address
    startingTokenBal: 0,    // starting token balance
    endingTokenBal: 0,      // ending token balance
    startingSolBal: 0,      // starting SOL balance
    endingSolBal: 0,        // ending SOL balance
    solAmount: 0,           // SOL amount involved
    tokenAmount: 0,         // token amount involved
    owner: ''               // transaction owner
  }

  // Set direction and owner
  result.dir = swapInstruction.name;
  result.owner = tradeEvent.data.user;

  // Set token address
  result.token_add = tradeEvent.data.mint;

  // Get pre/post balances
  const preBalances = rawTxn.meta.preTokenBalances || [];
  const postBalances = rawTxn.meta.postTokenBalances || [];

  // Set token balances
  for (const balance of preBalances) {
      if (balance.mint === result.tokenAddress) {
          result.startingTokenBal = parseFloat(balance.uiTokenAmount.uiAmountString);
      }
  }

  for (const balance of postBalances) {
      if (balance.mint === result.tokenAddress) {
          result.endingTokenBal = parseFloat(balance.uiTokenAmount.uiAmountString);
      }
  }

  // Set amounts from event data
  result.solAmount = tradeEvent.data.solAmount / 1e9; // Convert lamports to SOL
  result.tokenAmount = tradeEvent.data.tokenAmount / 1e6; // Convert to token decimals

  // Set virtual reserves
  result.virtualSolReserves = tradeEvent.data.virtualSolReserves / 1e9;  // Convert to SOL
  result.virtualTokenReserves = tradeEvent.data.virtualTokenReserves / 1e6;  // Convert to token units

  // Calculate SOL balances from raw balances
  const ownerPreBalance = rawTxn.meta.preBalances[
      rawTxn.transaction.message.staticAccountKeys.findIndex(key => key === result.owner)
  ];
  const ownerPostBalance = rawTxn.meta.postBalances[
      rawTxn.transaction.message.staticAccountKeys.findIndex(key => key === result.owner)
  ];

  if (ownerPreBalance && ownerPostBalance) {
      result.startingSolBal = ownerPreBalance / 1e9;  // Convert lamports to SOL
      result.endingSolBal = ownerPostBalance / 1e9;   // Convert lamports to SOL
  }

  return result;
}

export function humanizeTransactions(rawTxn, parsedTxn, type = "raydium") {
    let result = {
      swapEvents: [],
      isValid: false,
      error: null,
      timestamp: 0,
      slot: 0,
      signature: ''
    };

    let changes = [];

    try {
        // Get basic transaction info
        // and find the SPL tokens swaps
        if (rawTxn) {
            result.timestamp = rawTxn.blockTime;
            result.slot = rawTxn.slot;

            if (rawTxn.transaction?.signatures?.length > 0) {
                result.signature = rawTxn.transaction.signatures[0];
            }

            if(type === "raydium") {
              changes = findBalanceChanges(
                rawTxn.meta.preTokenBalances,
                rawTxn.meta.postTokenBalances
              );

              if (!changes) {
                throw new Error('Missing swap event or instruction');
              }
            }
        }


        // Find all swap instructions
        const swapInstructions = parsedTxn?.instructions?.filter(inst => {
          if(type === "pumpfun") {
            return ["buy", "sell"].includes(inst.name);
          }

          return ['swapBaseIn', 'swapBaseOut'].includes(inst.name) && inst.accounts?.length > 0;
        });

        if (!swapInstructions) {
          throw new Error('Missing swap event or instruction');
        }

        if(type === "pumpfun") {

          // Get transaction event data
          const tradeEvent = parsedTxn?.events?.find(event => event.name === 'TradeEvent');
          if (!tradeEvent) {
              throw new Error('Missing trade event data');
          }

          swapInstructions.forEach(swapInstruction => {
            let swapEvent = parsePumpfunEvent(rawTxn, tradeEvent, swapInstruction);

            if(!!swapEvent)
              result.swapEvents.push(swapEvent);

            // Basic validation
            if (swapEvent.solAmount <= 0 || swapEvent.tokenAmount <= 0) {
                throw new Error('Invalid amounts');
            }
          })

        } else {

          let currChanges = []; // process every 2
          changes.forEach((change, change_idx) => {
            currChanges.push(change);
            if((change_idx+1)%2 == 0) {
              const nth_swapEvent = Math.floor(change_idx / 2);
              const swapInstruction = swapInstructions[nth_swapEvent];

              const token_add = currChanges.find(x => x.mint != WSOL_MINT).mint;

              let swapEvent;
              if (!!token_add && !!swapInstruction) {
                swapEvent = parseRaydiumSwapEvent(currChanges, swapInstruction, token_add)

                // Validate amounts
                if (swapEvent.solAmount <= 0 || swapEvent.tokenAmount <= 0) {
                    throw new Error('Invalid swap amounts');
                }
              }

              currChanges = [];
              result.swapEvents.push(swapEvent);
            }
          })
        }

        result.isValid = true;
        return result;

    } catch (error) {
        return {
            ...result,
            isValid: false,
            error: error.message
        };
    }
}
