use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::VaultError;


#[derive(Accounts)]
pub struct CommitDraw<'info> {
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
pub fn _commit_draw(ctx:Context<CommitDraw>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(vault.locked,VaultError::VaultNotLocked);
    require!(vault.participant_count>0, VaultError::NoParticipants);
    require!(vault.drawn == false, VaultError::AlreadyDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);

    // No external randomness; keep a no-op commit for the learning flow.
    msg!("draw committed (naive mode)");
    Ok(())
}