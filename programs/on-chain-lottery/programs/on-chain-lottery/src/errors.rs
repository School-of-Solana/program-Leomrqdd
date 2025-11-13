use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Vault is locked")]
    VaultLocked,
    #[msg("Overflow")]
    Overflow,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("No participants")]
    NoParticipants,
    #[msg("Vault must be locked")]
    VaultNotLocked,
    #[msg("Randomness not committed")]
    RandomnessNotCommitted,
    #[msg("Randomness not resolved")]
    RandomnessNotResolved,
    #[msg("Already Drawn")]
    AlreadyDrawn,
    #[msg("Not drawn")]
    NotDrawn,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Invalid winner")]
    InvalidWinner,
}