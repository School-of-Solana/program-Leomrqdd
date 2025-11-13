use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub vault_authority: Pubkey,
    pub locked: bool,
    pub participant_count: u64,
    pub randomness_account: Pubkey, //committed randomness necessary for Switchboard
    pub commit_slot: u64,   // necessary for Switchboard
    pub winner_id: u64,
    pub drawn: bool, // true after settle_draw
    pub claimed: bool, // true after claim_if_winner
}

#[account]
#[derive(InitSpace)]
pub struct Participant { //Participant of a draw (linked to a Vault)
    pub vault: Pubkey,
    pub user: Pubkey,
    pub id: u64,
    pub is_initialized: bool,
}
