use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::VaultError;
use crate::events::WinnerDrawnEvent;
use orao_solana_vrf::state::RandomnessAccountData;


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
    /// CHECK: Must match the VRF randomness account stored in vault
    #[account(address = vault.randomness_account)]
    pub random: AccountInfo<'info>,
}
pub fn _settle_draw(ctx:Context<SettleDraw>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(vault.locked,VaultError::VaultNotLocked);
    require!(vault.participant_count>0, VaultError::NoParticipants);
    require!(vault.drawn == false, VaultError::AlreadyDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);

    // Read ORAO VRF randomness account and ensure it's fulfilled
    let mut data: &[u8] = &ctx.accounts.random.try_borrow_data()?;
    let randomness_account = RandomnessAccountData::try_deserialize_unchecked(&mut data)?;
    let randomness = match randomness_account.fulfilled_randomness() {
        Some(bytes) => bytes,
        None => return err!(VaultError::RandomnessNotResolved),
    };

    // Map randomness to a winner id in [0, participant_count)
    let value = u64::from_le_bytes(randomness[0..8].try_into().unwrap());
    let winner_id = value % vault.participant_count;

    // Update vault state
    vault.winner_id = winner_id;
    vault.drawn = true;

    emit!(WinnerDrawnEvent {
        vault: vault.key(),
        winner_id,
    });

    Ok(())
}

