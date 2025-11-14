use anchor_lang::prelude::*;

#[event]
pub struct InitializeVaultEvent {
    pub vault: Pubkey,
    pub vault_authority: Pubkey,
    pub locked: bool,
}

#[event]
pub struct DepositEvent {
    pub amount: u64,
    pub user: Pubkey,
    pub vault: Pubkey,
}


#[event]
pub struct ToggleLockEvent {
    pub vault: Pubkey,
    pub vault_authority: Pubkey,
    pub locked: bool,
}

#[event]
pub struct WinnerDrawnEvent {
    pub vault: Pubkey,
    pub winner_id: u64,
}

#[event]
pub struct WinnerClaimedEvent {
    pub vault: Pubkey,
    pub winner: Pubkey,
    pub amount: u64,
}