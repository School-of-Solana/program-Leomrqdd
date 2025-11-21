#![allow(unexpected_cfgs)]

//===============================================================================
///
/// SOLANA ON-CHAIN VAULT TASK
/// 
/// Your task is to complete the implementation of a Solana on-chain vault program.
/// The vault allows users to deposit SOL, withdraw SOL (if they're the authority),
/// and toggle the vault's lock state.
/// 
/// INSTRUCTIONS:
/// - Only modify code where you find TODO comments
/// - Follow the requirements specified in each instruction file
/// - Use the initialize instruction as a reference implementation
/// 
/// GENERAL HINTS:
/// - Use appropriate errors from errors.rs
/// - Use appropriate events from events.rs  
/// - Study account constraints in the initialize instruction
/// - Imports
/// 
/// GOOD LUCK!
/// 
///===============================================================================

use anchor_lang::prelude::*;
mod instructions;
mod state;
mod errors;
mod events;

use instructions::*;

declare_id!("4NYnTNsnq6xhph3QV9yKdou9uFuAmAqR236bPu8uXPcc");

#[program]
pub mod on_chain_lottery {
    use super::*;

    pub fn init_vault(ctx: Context<InitializeVault>, locked: bool) -> Result<()> {
      _init_vault(ctx, locked)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
      _deposit(ctx, amount)
    }

    pub fn commit_draw(ctx: Context<CommitDraw>, force: [u8; 32]) -> Result<()> {
      _commit_draw(ctx, force)
    }

    pub fn settle_draw(ctx: Context<SettleDraw>) -> Result<()> {
      _settle_draw(ctx)
    }

    pub fn claim_if_winner(ctx: Context<ClaimIfWinner>) -> Result<()> {
      _claim_if_winner(ctx)
    }

    pub fn toggle_lock(ctx: Context<ToggleLock>) -> Result<()> {
      _toggle_lock(ctx)
    }

    pub fn close_participant(ctx: Context<CloseParticipant>) -> Result<()> {
      _close_participant(ctx)
    }
}
