# Project Description

**Deployed Frontend URL:** https://ackee-vercel-lottery.vercel.app/

**Solana Program ID:** 4NYnTNsnq6xhph3QV9yKdou9uFuAmAqR236bPu8uXPcc (Devnet)

## Project Overview

### Description
On-chain Lottery is a simple vault-based lottery dApp built with Anchor and a Vite/React frontend powered by gill. Each vault is owned by a vault authority (a wallet). Users can deposit SOL into a vault, the vault authority can lock deposits and settle a draw to pick a winner, and the winning participant can claim the vault balance.

The project demonstrates:
- Clean PDA design for deterministic vault and participant accounts.
- A practical on-chain flow: initialize → deposit → lock → settle → claim.
- A modern frontend using gill with generated clients from Codama, including wallet UX and admin/user separation with the help of create-solana-dapp (vite)

### Key Features
- User
  - Deposit SOL into any vault by providing the vault authority address.
  - Claim prize if recognized as the winner after settlement.
- Admin (Vault Authority)
  - Initialize a personal vault.
  - Toggle lock (prevent further deposits).
  - Settle draw with a chosen winner ID (naive draw).
  - Inspect participants of the vault.
- Frontend
  - Vite/React with gill and Wallet UI.
  - Codama-generated TS client from the Anchor IDL.
  - Responsive UI with Tailwind and shadcn components.
  
### How to Use the dApp
1. Connect your wallet (Devnet).
2. Lottery (public):
   - Enter a “Vault authority” address or keep your own (placeholder).
   - Enter an amount in SOL and click “Deposit”.
   - If a draw has been settled and you are the winner, click “Claim”.
3. Admin (vault authority actions):
   - Go to the Admin page.
   - Initialize your vault (once).
   - Toggle lock when you want to stop deposits.
   - Settle draw by entering a winner ID and confirming.
   - See the list of participants (IDs and user pubkeys).


## Program Architecture
Anchor program with two main accounts: `Vault` and `Participant`. A vault is derived per authority; participants are derived per (vault, user). Users deposit lamports into the vault; the authority locks and settles to pick a winner; the winner can claim the entire vault (closing it).

### PDA Usage
PDAs ensure deterministic addresses and uniqueness:

**PDAs Used:**
- `vault = PDA(["vault", vault_authority])`
  - Purpose: one vault per authority.
- `participant = PDA(["participant", vault, user])`
  - Purpose: one participant account per (vault, user).

### Program Instructions
Core instructions:

**Instructions Implemented:**
- `initialize`/`init_vault(locked: bool)`: Creates a new vault for `vault_authority`, sets initial config and counters.
- `deposit(amount: u64)`: Transfers lamports from `user` to `vault`; initializes the `participant` PDA if first time; increments `participant_count`. Fails if `vault.locked`.
- `toggle_lock()`: Authority-only; flips `vault.locked` to prevent/allow deposits.
- `commit_draw()` (optional path in naive mode): No-op or placeholder prior to settlement in naive setup.
- `settle_draw(winner_id: u64)`: Authority-only; marks the draw as completed and records the chosen `winner_id` (naive selection).
- `claim_if_winner()`: If the caller’s `participant.id` matches the `winner_id`, transfers all lamports from the vault to the user and closes the vault.

### Account Structure
Main accounts modeled in Anchor:

```rust
#[account]
pub struct Vault {
    pub vault_authority: Pubkey,
    pub locked: bool,
    pub participant_count: u64,
    pub randomness_account: Pubkey,
    pub commit_slot: u64,
    pub winner_id: u64,
    pub drawn: bool,
    pub claimed: bool,
}

#[account]
pub struct Participant {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub id: u64,
    pub is_initialized: bool,
}
```

## Testing

### Test Coverage
Anchor TypeScript tests cover both happy and unhappy paths on Devnet:

**Happy Path Tests:**
- Initialize vault (unlocked).
- Users deposit into the vault; participant PDAs created; counts updated; vault balance increases.
- Toggle lock succeeds for the authority.
- Settle draw (naive) records a valid winner ID within range.
- Winner successfully claims; vault is closed and funds are transferred.

**Unhappy Path Tests:**
- Re-initializing an already initialized vault fails (“already in use”).
- Deposit after lock fails (“Vault is locked”).
- Settling multiple times fails (e.g., “AlreadyDrawn” or “AlreadyClaimed”).
- Claim by non-winner fails (“InvalidWinner”).

### Running Tests
```bash
# Commands to run your tests
anchor test
```

### Additional Notes for Evaluators

- Frontend is Vite/React with gill and Wallet UI; Codama is used to generate the TS client from the IDL (config in `frontend/on-chain-lottery-front/codama.json`).
- User and Admin functionality are clearly separated in the UI.
- The draw mechanism is intentionally naive for the learning scope; integrating an oracle/randomness provider is a natural next step. I am doing tests with Switchboard randomness tools : https://docs.switchboard.xyz/product-documentation/randomness/tutorials/solana-svm but it is not working yet.
