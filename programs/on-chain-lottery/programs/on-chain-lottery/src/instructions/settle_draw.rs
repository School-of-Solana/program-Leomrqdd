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
pub fn _settle_draw(ctx:Context<SettleDraw>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(vault.locked,VaultError::VaultNotLocked);
    require!(vault.participant_count>0, VaultError::NoParticipants);
    require!(vault.drawn == false, VaultError::AlreadyDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);

    let clock = Clock::get()?;
    // Very naive "randomness": use current slot only
    let slot = clock.slot;
    let winner_id = slot % vault.participant_count;

    vault.winner_id = winner_id;
    vault.drawn = true;

    // Build a trivial 32-byte "randomness" from slot
    let mut randomness = [0u8; 32];
    randomness[..8].copy_from_slice(&slot.to_le_bytes());

    emit!(WinnerDrawnEvent {
        vault: vault.key(),
        winner_id,
        randomness,
    });

    Ok(())
}

