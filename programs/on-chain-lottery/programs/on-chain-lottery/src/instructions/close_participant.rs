//-------------------------------------------------------------------------------
///
/// Close a participant account to participate in a new lottery
/// 
/// This instruction allows a participant to close their account and recover
/// the rent. They must close their old participant account before they can
/// deposit in a new lottery.
/// 
///-------------------------------------------------------------------------------

use anchor_lang::prelude::*;
use crate::state::Participant;

#[derive(Accounts)]
pub struct CloseParticipant<'info> {
    /// The user who owns the participant account
    #[account(mut)]
    pub user: Signer<'info>,

    /// The participant account to close
    /// The rent will be refunded to the user
    #[account(
        mut,
        close = user,
        has_one = user,
        seeds = [b"participant", participant.vault.as_ref(), user.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,
}

pub fn _close_participant(_ctx: Context<CloseParticipant>) -> Result<()> {
    // The participant account will be closed automatically by Anchor
    // and rent refunded to the user
    Ok(())
}

