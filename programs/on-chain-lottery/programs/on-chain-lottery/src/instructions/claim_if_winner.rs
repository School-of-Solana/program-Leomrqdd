//-------------------------------------------------------------------------------
///
/// TASK: Implement the deposit functionality for the on-chain vault
/// 
/// Requirements:
/// - Verify that the user has enough balance to deposit
/// - Verify that the vault is not locked
/// - Transfer lamports from user to vault using CPI (Cross-Program Invocation)
/// - Emit a deposit event after successful transfer
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use crate::state::{Vault,Participant};
use crate::errors::VaultError;
use crate::events::{WinnerClaimedEvent};

#[derive(Accounts)]
pub struct ClaimIfWinner<'info> {
    // TODO: Add required accounts and constraints
    #[account(mut)]
    pub user: Signer<'info>,

    pub vault_authority: SystemAccount<'info>,

    #[account(
        mut,
        has_one = vault_authority,
        close = user,
        seeds = [b"vault", vault_authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info,Vault>,

    #[account(
        mut,
        seeds = [b"participant", vault.key().as_ref(),user.key().as_ref()],
        bump
    )]
    pub participant: Account<'info,Participant>,
}

pub fn _claim_if_winner(ctx: Context<ClaimIfWinner>) -> Result<()> {

    let user = &mut ctx.accounts.user;
    let vault = &mut ctx.accounts.vault;
    let participant = &mut ctx.accounts.participant;

    require!(vault.locked == true, VaultError::VaultNotLocked);
    require!(vault.drawn == true, VaultError::NotDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);
    require!(participant.vault== vault.key(), VaultError::InvalidWinner);
    require!(participant.is_initialized, VaultError::InvalidWinner);
    require!(vault.winner_id == participant.id, VaultError::InvalidWinner);

    let payout = vault.to_account_info().lamports();
    vault.claimed = true;
    
    emit!(WinnerClaimedEvent {
        vault: vault.key(),
        winner: user.key(),
        amount : payout
    });

    Ok(())
}