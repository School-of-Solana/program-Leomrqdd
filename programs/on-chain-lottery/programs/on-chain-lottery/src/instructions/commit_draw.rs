use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::VaultError;
use orao_solana_vrf::{
    self,
    program::OraoVrf,
    state::{network_state::NetworkState},
    RANDOMNESS_ACCOUNT_SEED,
    CONFIG_ACCOUNT_SEED,
};
use anchor_lang::Key; // for `.key()` in seeds



#[derive(Accounts)]
#[instruction(force: [u8; 32])]
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
    /// CHECK:
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [CONFIG_ACCOUNT_SEED],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub config: Account<'info, NetworkState>,
    /// CHECK:
    #[account(
        mut,
        seeds = [RANDOMNESS_ACCOUNT_SEED, &force],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub random: AccountInfo<'info>,
    pub vrf: Program<'info, OraoVrf>,
    pub system_program: Program<'info, System>,
}
pub fn _commit_draw(ctx:Context<CommitDraw>, force: [u8; 32]) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(vault.locked,VaultError::VaultNotLocked);
    require!(vault.participant_count>0, VaultError::NoParticipants);
    require!(vault.drawn == false, VaultError::AlreadyDrawn);
    require!(vault.claimed == false, VaultError::AlreadyClaimed);

    // CPI vers ORAO VRF: RequestV2
    let cpi_program = ctx.accounts.vrf.to_account_info();
    let cpi_accounts = orao_solana_vrf::cpi::accounts::RequestV2 {
        payer: ctx.accounts.vault_authority.to_account_info(),
        network_state: ctx.accounts.config.to_account_info(),
        treasury: ctx.accounts.treasury.to_account_info(),
        request: ctx.accounts.random.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    orao_solana_vrf::cpi::request_v2(cpi_ctx, force)?;

    // Persist randomness account and commit slot for later settlement.
    vault.randomness_account = ctx.accounts.random.key();
    vault.commit_slot = Clock::get()?.slot;
    msg!("VRF randomness requested via ORAO (CPI).");
    Ok(())
}