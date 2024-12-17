#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

declare_id!("pyg7Rgvvw35upbJooTv9aFgdrq6pJubr4dCxusy8T1X");

fn calculate_available_tokens(total_tokens: u64, created_at: i64) -> u64 {
    let current_time = Clock::get()?.unix_timestamp; // replaced .unwrap() with ?
    let days_elapsed = (current_time - created_at) / (24 * 60 * 60);
    
    // Initial 10% immediately
    let initial_unlock = (total_tokens * 10) / 100;
    
    // Calculate number of 14-day periods that have passed
    let periods = (days_elapsed / 14) as u64;
    
    // Each period unlocks 10%, up to the remaining 90%
    let additional_periods = std::cmp::min(9, periods); // 9 periods of 10% = 90%
    // let additional_unlock = (total_tokens * 10 * additional_periods) / 100;
    // 
    // initial_unlock + additional_unlock

     // Safe calculation for additional unlock
    let additional_unlock = total_tokens.checked_mul(10)
        .ok_or(ErrorCode::ArithmeticError)?
        .checked_mul(additional_periods)
        .ok_or(ErrorCode::ArithmeticError)?
        .checked_div(100)
        .ok_or(ErrorCode::ArithmeticError)?;
    
        // Total unlocked tokens
    initial_unlock + additional_unlock
}

#[program]
pub mod pepedrop {
    use super::*;

    pub fn initialize_token_vault(
        ctx: Context<IntializeTokenVault>,
        vault_name: String,
        total_tokens: u64,
    ) -> Result<()> {
        *ctx.accounts.token_vault = TokenVault {
            vault_name,
            owner: ctx.accounts.owner.key(),
            mint: ctx.accounts.mint.key(),
            total_tokens,
            treasury: ctx.accounts.treasury.key(),
            tokens_released: 0,
            tokens_claimed: 0,
            total_token_holders: 0,
            bump: ctx.bumps.token_vault,
            treasury_bump: ctx.bumps.treasury,
        };

        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.source_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );

        transfer_checked(cpi_ctx, total_tokens, ctx.accounts.mint.decimals)?;
        Ok(())
    }

    pub fn create_claim_account(
        ctx: Context<CreateClaimAccount>,
        amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.token_vault.tokens_released + amount <= ctx.accounts.token_vault.total_tokens,
            PepeDropError::InsufficientTokens
        );

        ctx.accounts.token_vault.tokens_released += amount;
        ctx.accounts.token_vault.total_token_holders += 1;

        *ctx.accounts.claim_account = ClaimAccount {
            beneficiary: ctx.accounts.beneficiary.key(),
            token_vault: ctx.accounts.token_vault.key(),
            mint: ctx.accounts.token_vault.mint.key(),
            total_tokens: amount,
            tokens_claimed: 0,
            created_at: Clock::get()?.unix_timestamp,
            bump: ctx.bumps.claim_account,
        };
        
        Ok(())
    }

    pub fn claim_tokens(
        ctx: Context<ClaimTokens>,
    ) -> Result<()> {
        // Check if amount is available based on vesting schedule
        let available = calculate_available_tokens(ctx.accounts.claim_account.total_tokens, ctx.accounts.claim_account.created_at);  
        let claimable = available.saturating_sub(ctx.accounts.claim_account.tokens_claimed);

        msg!("Total tokens: {}", ctx.accounts.claim_account.total_tokens);
        msg!("Available: {}", available);
        msg!("Claimable: {}", claimable);
        
        require!(
            claimable > 0,
            PepeDropError::InsufficientUnlockedTokens
        );

        // Update claim account state
        ctx.accounts.claim_account.tokens_claimed += claimable;
        ctx.accounts.token_vault.tokens_claimed += claimable;

        // Transfer tokens from treasury to user
        let token_vault_key = ctx.accounts.token_vault.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"treasury".as_ref(),
            token_vault_key.as_ref(),
            &[ctx.accounts.token_vault.treasury_bump],
        ]];
        
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.beneficiary_associated_token_account.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_cpi_accounts).with_signer(signer_seeds);

        transfer_checked(cpi_ctx, claimable, ctx.accounts.mint.decimals)?;
        Ok(())
    }

    pub fn initialize_token_vault_for_okx(
        ctx: Context<IntializeTokenVaultForOkx>,
        vault_name: String,
        total_tokens: u64,
    ) -> Result<()> {
        *ctx.accounts.token_vault = TokenVault {
            vault_name,
            owner: ctx.accounts.owner.key(),
            mint: ctx.accounts.mint.key(),
            total_tokens,
            treasury: ctx.accounts.treasury.key(),
            tokens_released: 0,
            tokens_claimed: 0,
            total_token_holders: 0,
            bump: ctx.bumps.token_vault,
            treasury_bump: ctx.bumps.treasury,
        };

        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.source_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );

        transfer_checked(cpi_ctx, total_tokens, ctx.accounts.mint.decimals)?; 
        Ok(())
    }


    pub fn send_tokens_to_okx(
        ctx: Context<SendTokensToOkx>,
        amount: u64,
    ) -> Result<()> {
        require!(
            amount <= ctx.accounts.treasury.amount,
            PepeDropError::InsufficientTokens
        );

        let token_vault_key = ctx.accounts.token_vault.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"treasury".as_ref(),
            token_vault_key.as_ref(),
            &[ctx.accounts.token_vault.treasury_bump],
        ]];

        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };


        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_cpi_accounts).with_signer(signer_seeds);

        // this code brought to the top
        ctx.accounts.token_vault.tokens_claimed += amount;
        
        transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        // replaced code from here
        Ok(())
    }
}

#[derive(Accounts)]
pub struct IntializeTokenVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + TokenVault::INIT_SPACE,
        seeds = [b"token_vault".as_ref(), mint.key().as_ref()],
        bump

    )]
    pub token_vault: Account<'info, TokenVault>,
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = treasury,
        seeds = [b"treasury".as_ref(), token_vault.key().as_ref()],
        bump
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner
    )]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenVault {
    pub owner: Pubkey,
    #[max_len(40)]
    pub vault_name: String,
    pub mint: Pubkey,
    pub total_tokens: u64,
    pub treasury: Pubkey,
    pub tokens_released: u64,
    pub tokens_claimed: u64,
    pub total_token_holders: u64,
    pub bump: u8,
    pub treasury_bump: u8,
}

#[derive(Accounts)]
pub struct CreateClaimAccount<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub beneficiary: SystemAccount<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + ClaimAccount::INIT_SPACE,
        seeds = [b"claim_account".as_ref(), token_vault.key().as_ref(), beneficiary.key().as_ref()],
        bump,
    )]
    pub claim_account: Account<'info, ClaimAccount>,
    


    #[account(
        mut,
        seeds = [b"token_vault".as_ref(), mint.key().as_ref()],
        bump,
        constraint = token_vault.owner == signer.key()
    )]
    pub token_vault: Account<'info, TokenVault>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [b"claim_account".as_ref(), token_vault.key().as_ref(), beneficiary.key().as_ref()],
        bump,
        has_one = beneficiary,
        has_one = token_vault,
    )]
    pub claim_account: Account<'info, ClaimAccount>,

    #[account(mut,
        seeds = [b"token_vault".as_ref(), mint.key().as_ref()],
        has_one = treasury,
        bump
    )]
    pub token_vault: Account<'info, TokenVault>,
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"treasury".as_ref(), token_vault.key().as_ref()],
        bump
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
        associated_token::token_program = token_program,
    )]
    pub beneficiary_associated_token_account: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimAccount {
    pub beneficiary: Pubkey,
    pub token_vault: Pubkey,
    pub mint: Pubkey,
    pub total_tokens: u64,
    pub tokens_claimed: u64,
    pub created_at: i64,
    pub bump: u8,
}


#[derive(Accounts)]
pub struct IntializeTokenVaultForOkx<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + TokenVault::INIT_SPACE,
        seeds = [b"token_vault_okx".as_ref(), mint.key().as_ref(), owner.key().as_ref()],
        bump

    )]
    pub token_vault: Account<'info, TokenVault>,
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = treasury,
        seeds = [b"treasury".as_ref(), token_vault.key().as_ref()],
        bump
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner
    )]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct SendTokensToOkx<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_vault_okx".as_ref(), mint.key().as_ref(), owner.key().as_ref()],
        bump,
        has_one = treasury,
        constraint = token_vault.owner == owner.key()
    )]
    pub token_vault: Account<'info, TokenVault>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    #[account(
        mut,
        seeds = [b"treasury".as_ref(), token_vault.key().as_ref()],
        bump
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = destination_wallet,
        associated_token::token_program = token_program,
    )]
    pub destination_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The wallet that owns the destination token account
    pub destination_wallet: SystemAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[error_code]
pub enum PepeDropError {
    #[msg("Insufficient tokens available in vault")]
    InsufficientTokens,
    #[msg("Insufficient unlocked tokens available to claim")]
    InsufficientUnlockedTokens,
}