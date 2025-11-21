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
use anchor_lang::solana_program::program::invoke;
use anchor_lang::system_program::{Transfer,transfer};
use crate::state::{Vault,Participant};
use crate::errors::VaultError;
use crate::events::DepositEvent;

#[derive(Accounts)]
pub struct Deposit<'info> {
    // TODO: Add required accounts and constraints
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info,Vault>,
    #[account(
        init,
        payer = user,
        space = 8 + Participant::INIT_SPACE,
        seeds = [b"participant", vault.key().as_ref(),user.key().as_ref()],
        bump
    )]
    pub participant: Account<'info,Participant>,
    pub system_program: Program<'info, System>,
}

pub fn _deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // TODO: Implement deposit functionality
    let user = &mut ctx.accounts.user;
    let vault = &mut ctx.accounts.vault;
    let participant = &mut ctx.accounts.participant;

    require!(user.lamports() >= amount,VaultError::InsufficientBalance);
    require!(vault.locked == false, VaultError::VaultLocked);

    // Initialize participant (only possible once with 'init' constraint)
    participant.vault = vault.key();
    participant.lottery_id = vault.lottery_id;
    participant.user = user.key();
    participant.id = vault.participant_count;
    participant.is_initialized = true;
    vault.participant_count = vault.participant_count.checked_add(1).ok_or(VaultError::Overflow)?;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer{
            from: user.to_account_info(),
            to : vault.to_account_info()
        }
    );

    transfer(cpi_context,amount)?;

    emit!(DepositEvent {
        amount: amount,
        user: user.key(),
        vault : vault.key()
    });


    Ok(())


}