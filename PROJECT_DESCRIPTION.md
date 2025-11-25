# Project Description

**Deployed Frontend URL:** [https://v2-ackee-vercel-lottery.vercel.app/](https://v2-ackee-vercel-lottery.vercel.app/)

**Solana Program ID:** 4NYnTNsnq6xhph3QV9yKdou9uFuAmAqR236bPu8uXPcc (Devnet)

## Project Overview

### Description

On-chain Lottery is a vault-based lottery dApp built with Anchor and a Vite/React frontend powered by gill. Each vault is owned by a vault authority (a wallet). Users can deposit SOL into a vault, the vault authority can lock deposits, commit a randomness request via ORAO VRF, settle a draw to pick a winner using on-chain randomness, and the winning participant can claim the vault balance. The system supports multiple successive lotteries with the same vault, allowing participants to close their old accounts and participate in new draws.

The project demonstrates:

- Clean PDA design for deterministic vault and participant accounts.
- A practical on-chain flow: initialize → deposit → lock → commit_draw (ORAO VRF) → settle_draw → claim.
- Integration with [ORAO VRF](https://orao.network/solana-vrf) for verifiable on-chain randomness.
- Support for multiple successive lotteries with participant account management.
- A modern frontend using gill with generated clients from Codama, including wallet UX and admin/user separation with the help of create-solana-dapp (vite)

### Key Features

- User
  - Deposit SOL into any vault by providing the vault authority address.
  - Claim prize if recognized as the winner after settlement.
  - Close participant account to participate in a new lottery (recover rent).
- Admin (Vault Authority)
  - Initialize a personal vault (supports multiple successive lotteries).
  - Toggle lock (prevent further deposits).
  - Commit draw by requesting randomness from ORAO VRF.
  - Settle draw using on-chain verifiable randomness to select a winner.
  - Inspect participants of the vault.
- Frontend
  - Vite/React with gill and Wallet UI.
  - Codama-generated TS client from the Anchor IDL.
  - Responsive UI with Tailwind and shadcn components.

### How to Use the dApp

1. Connect your wallet (Devnet).
2. Lottery (public):
   - Enter a "Vault authority" address or keep your own (placeholder).
   - Enter an amount in SOL and click "Deposit".
   - If a draw has been settled and you are the winner, click "Claim".
   - Close your participant account if you want to participate in a new lottery.
3. Admin (vault authority actions):
   - Go to the Admin page.
   - Initialize your vault (once, can be reused for multiple lotteries).
   - Toggle lock when you want to stop deposits.
   - Commit draw to request randomness from ORAO VRF (wait for fulfillment).
   - Settle draw using the fulfilled randomness to automatically select a winner.
   - See the list of participants (IDs and user pubkeys).

## Program Architecture

Anchor program with two main accounts: `Vault` and `Participant`. A vault is derived per authority; participants are derived per (vault, user). Users deposit lamports into the vault; the authority locks deposits, commits a randomness request via ORAO VRF, settles the draw using verifiable on-chain randomness to pick a winner; the winner can claim the entire vault (closing it). The system supports multiple successive lotteries: after a lottery ends, participants can close their accounts and the vault can be reinitialized for a new lottery.

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

- `init_vault(locked: bool)`: Creates a new vault for `vault_authority`, sets initial config, counters, and `lottery_id`. Can be called multiple times to start new lotteries after previous ones have ended.
- `deposit(amount: u64)`: Transfers lamports from `user` to `vault`; initializes the `participant` PDA if first time (or reinitializes if `lottery_id` changed); increments `participant_count`. Fails if `vault.locked` or if participant exists with different `lottery_id`.
- `toggle_lock()`: Authority-only; flips `vault.locked` to prevent/allow deposits.
- `commit_draw(force: [u8; 32])`: Authority-only; requests randomness from ORAO VRF via CPI. Stores the randomness account address and commit slot in the vault. Fails if vault is not locked, has no participants, or already drawn.
- `settle_draw()`: Authority-only; reads fulfilled randomness from ORAO VRF account, maps it to a winner ID in `[0, participant_count)`, and marks the draw as completed. Fails if randomness is not fulfilled, vault is not locked, or already drawn.
- `claim_if_winner()`: If the caller's `participant.id` matches the `winner_id`, transfers all lamports from the vault to the user and closes the vault. Fails if caller is not the winner.
- `close_participant()`: Allows a user to close their participant account and recover rent. Required before participating in a new lottery if the participant account already exists.

### Account Structure

Main accounts modeled in Anchor:

```rust
#[account]
pub struct Vault {
    pub vault_authority: Pubkey,
    pub lottery_id: u64, // Increments each time a new lottery starts
    pub locked: bool,
    pub participant_count: u64,
    pub randomness_account: Pubkey, // ORAO VRF randomness account address
    pub commit_slot: u64, // Slot when randomness was committed
    pub winner_id: u64,
    pub drawn: bool, // true after settle_draw
    pub claimed: bool, // true after claim_if_winner
}

#[account]
pub struct Participant {
    pub vault: Pubkey,
    pub lottery_id: u64, // Which lottery this participant belongs to
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
- Multiple users deposit into the vault; participant PDAs created with correct `lottery_id`; counts updated; vault balance increases.
- Toggle lock succeeds for the authority.
- Commit draw requests randomness from ORAO VRF; randomness account and commit slot stored.
- Wait for ORAO VRF fulfillment and settle draw; winner ID calculated from verifiable randomness within valid range.
- Winner successfully claims; vault is closed and funds are transferred.
- Create new lottery by reinitializing vault; old participants can close accounts and participate in new lottery.

**Unhappy Path Tests:**

- Deposit after lock fails ("Vault is locked").
- Deposit when participant exists with different `lottery_id` fails ("already in use").
- Commit draw when vault is not locked fails ("VaultNotLocked").
- Settle draw when randomness is not fulfilled fails ("RandomnessNotResolved").
- Settling multiple times fails ("AlreadyDrawn").
- Claim by non-winner fails ("InvalidWinner").
- Deposit without closing old participant account fails ("already in use").

### Running Tests

```bash
# Commands to run your tests
anchor test
```

### Additional Notes for Evaluators

- Frontend is Vite/React with gill and Wallet UI; Codama is used to generate the TS client from the Anchor IDL (config in `frontend/on-chain-lottery-front/codama.json`).
- User and Admin functionality are clearly separated in the UI.
- The draw mechanism uses **[ORAO VRF](https://orao.network/solana-vrf)** for verifiable on-chain randomness. The flow requires: (1) `commit_draw` to request randomness via CPI to ORAO VRF, (2) waiting for fulfillment on-chain, (3) `settle_draw` to read the fulfilled randomness and select the winner deterministically. For more information, see the [ORAO VRF documentation](https://docs.orao.network/) and [GitHub repository](https://github.com/orao-network/solana-vrf).
- The system supports multiple successive lotteries: after a lottery ends and the vault is closed, the vault authority can reinitialize it for a new lottery. Participants must close their old accounts before depositing in a new lottery.
- Tests run on Devnet and include integration with ORAO VRF network state and randomness accounts.
- The `lottery_id` field ensures participants from previous lotteries cannot interfere with new ones.
