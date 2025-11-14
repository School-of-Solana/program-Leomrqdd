use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::VaultError;
use crate::events::WinnerDrawnEvent;
// Naive randomness: no external dependency


#[derive(Accounts)]
pub struct SettleDraw<'info> {
    #[account(mut)]
    pub vault_authority:Signer<'info>,
    #[account(
        mut,
        has_one = vault_authority,
        seeds = [b"vault", vault_authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info,Vault>,
}
pub fn _settle_draw(ctx:Context<SettleDraw>, winner_id: u64) -> Result<()> {
    // no random first or done outside
    let vault = &mut ctx.accounts.vault;
    require!(vault.locked,VaultError::VaultNotLocked);
    require!(vault.participant_count>0, VaultError::NoParticipants);
    require!(vault.drawn == false, VaultError::AlreadyDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);

    // Validate provided winner id against participant count
    require!(winner_id < vault.participant_count, VaultError::InvalidWinner);

    // Update vault state
    vault.winner_id = winner_id;
    vault.drawn = true;

    emit!(WinnerDrawnEvent {
        vault: vault.key(),
        winner_id,
    });

    Ok(())
}

