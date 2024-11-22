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

        if (post && pre.owner !== ignoreAccount && pre.owner == RAYDIUM_AUTHORITY_V4) {
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

function parseSwapEvent(changes, swapInstruction, token_add) {
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

export function analyzeSolanaTransaction(rawTxn, parsedTxn) {
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

            changes = findBalanceChanges(
              rawTxn.meta.preTokenBalances,
              rawTxn.meta.postTokenBalances,
              result.lpAddress
            );

            if (!changes) {
              throw new Error('Missing swap event or instruction');
            }
        }

        // Find all swap instructions
        const swapInstructions = parsedTxn?.instructions?.filter(inst => ['swapBaseIn', 'swapBaseOut'].includes(inst.name) && inst.accounts?.length > 0);

        if (!swapInstructions) {
          throw new Error('Missing swap event or instruction');
        }

        let currChanges = []; // process every 2
        changes.forEach((change, change_idx) => {
          currChanges.push(change);
          if((change_idx+1)%2 == 0) {
            const nth_swapEvent = Math.floor(change_idx / 2);
            const swapInstruction = swapInstructions[nth_swapEvent];

            const token_add = currChanges.find(x => x.mint != WSOL_MINT).mint;

            let swapEvent;
            if (!!token_add && !!swapInstruction) {
              swapEvent = parseSwapEvent(currChanges, swapInstruction, token_add)

              // Validate amounts
              if (swapEvent.solAmount <= 0 || swapEvent.tokenAmount <= 0) {
                  throw new Error('Invalid swap amounts');
              }
            }

            currChanges = [];
            result.swapEvents.push(swapEvent);
          }
        })

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
