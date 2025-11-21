//-------------------------------------------------------------------------------
///
/// REFERENCE IMPLEMENTATION: Initialize Vault Instruction
/// 
/// This instruction is fully implemented and serves as an example for you to study
/// when implementing the other instructions (deposit, withdraw, toggle_lock).
/// 
/// Key Concepts Demonstrated:
/// - Account constraints and validation using #[account(...)] attributes
/// - PDA (Program Derived Address) creation with seeds and bump
/// - Account initialization with proper space allocation
/// - Event emission after successful operations
/// 
/// Use this as your reference when implementing the TODO instructions!
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::events::InitializeVaultEvent;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub vault_authority: Signer<'info>,
    #[account(
        init, 
        payer = vault_authority, 
        // space = discriminant + account size
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", vault_authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn _init_vault(ctx: Context<InitializeVault>, locked: bool) -> Result<()> {
  let vault = &mut ctx.accounts.vault;

  // Get the current slot as lottery_id (unique identifier for this lottery)
  let lottery_id = Clock::get()?.slot;

  vault.vault_authority = ctx.accounts.vault_authority.key();
  vault.lottery_id = lottery_id;
  vault.locked = locked;
  vault.participant_count = 0;
  vault.randomness_account = Pubkey::default();
  vault.commit_slot = 0;
  vault.winner_id = 0;
  vault.drawn = false;
  vault.claimed = false;

  emit!(InitializeVaultEvent {
    vault: vault.key(),
    vault_authority: vault.vault_authority,
    locked,
  });

  Ok(())
}