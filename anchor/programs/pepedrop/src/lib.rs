#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

#[program]
pub mod pepedrop {
    use super::*;

  pub fn close(_ctx: Context<ClosePepedrop>) -> Result<()> {
    Ok(())
  }

  pub fn decrement(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.pepedrop.count = ctx.accounts.pepedrop.count.checked_sub(1).unwrap();
    Ok(())
  }

  pub fn increment(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.pepedrop.count = ctx.accounts.pepedrop.count.checked_add(1).unwrap();
    Ok(())
  }

  pub fn initialize(_ctx: Context<InitializePepedrop>) -> Result<()> {
    Ok(())
  }

  pub fn set(ctx: Context<Update>, value: u8) -> Result<()> {
    ctx.accounts.pepedrop.count = value.clone();
    Ok(())
  }
}

#[derive(Accounts)]
pub struct InitializePepedrop<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  init,
  space = 8 + Pepedrop::INIT_SPACE,
  payer = payer
  )]
  pub pepedrop: Account<'info, Pepedrop>,
  pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ClosePepedrop<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  mut,
  close = payer, // close account and return lamports to payer
  )]
  pub pepedrop: Account<'info, Pepedrop>,
}

#[derive(Accounts)]
pub struct Update<'info> {
  #[account(mut)]
  pub pepedrop: Account<'info, Pepedrop>,
}

#[account]
#[derive(InitSpace)]
pub struct Pepedrop {
  count: u8,
}
