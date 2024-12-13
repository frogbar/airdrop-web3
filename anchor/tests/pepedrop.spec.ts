import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Pepedrop } from "../target/types/pepedrop";
import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";

import IDL from "../target/idl/pepedrop.json";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BankrunProvider } from "anchor-bankrun";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
} from "spl-token-bankrun";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { log } from "console";

async function advanceTimeAndClaim(
  program: Program<Pepedrop>,
  context: ProgramTestContext,
  daysToAdvance: number,
  beneficiary: Keypair,
  tokenName: string,
  mint: PublicKey
): Promise<any> {
  // Advance clock by specified days
  context.setClock(
    new Clock(
      BigInt(0), // slot
      BigInt(0), // epochStartTimestamp
      BigInt(0), // epoch
      BigInt(0), // leaderScheduleEpoch
      BigInt(Math.floor(Date.now() / 1000) + daysToAdvance * 24 * 60 * 60) // unix_timestamp as BigInt
    )
  );

  // Attempt to claim tokens
  return program.methods
    .claimTokens()
    .accounts({
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([beneficiary])
    .rpc();
}

async function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("pepedrop", () => {
  const pepedropKeypair = Keypair.generate();
  const tokenName = "PeppeDrop";
  const tokenSymbol = "PPDROP";

  const totalAmount = 100000;

  const claimAmount = 1000;

  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Pepedrop>;
  let banksClient: BanksClient;

  let beneficiary: Keypair;
  let creator: Keypair;
  let mint: PublicKey;

  let beneficiaryProvider: BankrunProvider;
  let program2: Program<Pepedrop>;
  let tokenVaultAccount: PublicKey;
  let tokenVaultAccountKey: PublicKey;
  let tokenVaultOkxAccountKey: PublicKey;
  let claimAccount: PublicKey;
  let claimAccountKey: PublicKey;
  let creatorTokenAccount: PublicKey;
  let treasuryKey: PublicKey;

  beforeAll(async () => {
    beneficiary = new anchor.web3.Keypair();

    context = await startAnchor(
      "",
      [
        {
          name: "pepedrop",
          programId: new PublicKey(IDL.address),
        },
      ],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: 10_000_000_000,
            data: Buffer.alloc(0),
            executable: false,
            owner: SYSTEM_PROGRAM_ID,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    program = new Program<Pepedrop>(IDL as Pepedrop, provider);

    banksClient = context.banksClient;

    creator = provider.wallet.payer;

    beneficiaryProvider = new BankrunProvider(context);
    beneficiaryProvider.wallet = new NodeWallet(beneficiary);

    program2 = new Program<Pepedrop>(IDL as Pepedrop, beneficiaryProvider);

    // @ts-expect-error - Type mismatch in spl-token-bankrun and solana banks client
    mint = await createMint(banksClient, creator, creator.publicKey, null, 2);

    [tokenVaultAccountKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), mint.toBuffer()],
      program.programId
    );

    [tokenVaultOkxAccountKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_vault_okx"),
        mint.toBuffer(),
        creator.publicKey.toBuffer(),
      ],
      program.programId
    );

    [claimAccountKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("claim_account"),
        tokenVaultAccountKey.toBuffer(),
        beneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    creatorTokenAccount = await createAssociatedTokenAccount(
      // @ts-expect-error - Type mismatch in spl-token-bankrun and solana banks client
      banksClient,
      creator,
      mint,
      creator.publicKey,
      TOKEN_PROGRAM_ID
    );

    // // Mint some tokens to the creator's account
    await mintTo(
      // @ts-expect-error - Type mismatch in spl-token-bankrun and solana banks client
      banksClient,
      creator,
      mint,
      creatorTokenAccount,
      creator,
      totalAmount * 2
    );
  });

  it("should initialize the claim account", async () => {
    const tx = await program.methods
      .initializeTokenVault(tokenName, new BN(totalAmount))
      .accounts({
        owner: creator.publicKey,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        sourceTokenAccount: creatorTokenAccount,
      })
      .signers([creator])
      .rpc();

    const tokenVaultAccountData = await program.account.tokenVault.fetch(
      tokenVaultAccountKey,
      "confirmed"
    );

    console.log(tokenVaultAccountData);

    expect(tokenVaultAccountData.vaultName).toBe(tokenName);
    expect(tokenVaultAccountData.totalTokens.toNumber()).toBe(totalAmount);

    console.log("tokenVaultData: ", tokenVaultAccountData.treasury);

    // console.log("Treasury Key:", treasuryKey.toBase58());
    const treasuryData = await getAccount(
      // @ts-expect-error - Type mismatch in spl-token-bankrun and solana banks client
      banksClient,
      tokenVaultAccountData.treasury
    );
    console.log("Vault Token Account Data:", treasuryData);
    //
    expect(treasuryData.amount).toBe(BigInt(totalAmount));
  });

  it("should create a claim account", async () => {
    const tx = await program.methods
      .createClaimAccount(new BN(claimAmount))
      .accounts({
        mint,
        signer: creator.publicKey,
        beneficiary: beneficiary.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const claimAccountData = await program.account.claimAccount.fetch(
      claimAccountKey,
      "confirmed"
    );

    console.log(claimAccountData);

    expect(claimAccountData.totalTokens.toNumber()).toBe(claimAmount);
    expect(claimAccountData.tokensClaimed.toNumber()).toBe(0);
  });

  it("should claim tokens according to vesting schedule", async () => {
    try {
      // Initial claim (20% immediate unlock)
      await advanceTimeAndClaim(
        program2,
        context,
        0,
        beneficiary,
        tokenName,
        mint
      );
      await pause(2000); // Add delay after transaction
      let claimAccountData = await program.account.claimAccount.fetch(
        claimAccountKey,
        "confirmed"
      );
      expect(claimAccountData.tokensClaimed.toNumber()).toBe(claimAmount * 0.2);

      // After 2 weeks (20% + 10%)
      await advanceTimeAndClaim(
        program2,
        context,
        14,
        beneficiary,
        tokenName,
        mint
      );
      await pause(2000); // Add delay after transaction
      claimAccountData = await program.account.claimAccount.fetch(
        claimAccountKey,
        "confirmed"
      );
      expect(claimAccountData.tokensClaimed.toNumber()).toBe(claimAmount * 0.3);

      // After 4 weeks (20% + 20%)
      await advanceTimeAndClaim(
        program2,
        context,
        28,
        beneficiary,
        tokenName,
        mint
      );
      await pause(2000); // Add delay after transaction
      claimAccountData = await program.account.claimAccount.fetch(
        claimAccountKey,
        "confirmed"
      );
      expect(claimAccountData.tokensClaimed.toNumber()).toBe(claimAmount * 0.4);

      // After 16 weeks (fully vested)
      await advanceTimeAndClaim(
        program2,
        context,
        112,
        beneficiary,
        tokenName,
        mint
      );
      await pause(2000); // Add delay after transaction
      claimAccountData = await program.account.claimAccount.fetch(
        claimAccountKey,
        "confirmed"
      );
      expect(claimAccountData.tokensClaimed.toNumber()).toBe(claimAmount);
    } catch (error) {
      console.error("Error details:", error);
      throw error;
    }
  }, 30000); // Set test timeout to 30 seconds

  it("should fail to claim tokens when no tokens are available", async () => {
    // Create a new claim account with more tokens than available in vault
    const excessiveAmount = totalAmount + 1000;

    try {
      // After 17 weeks (fully vested)
      await advanceTimeAndClaim(
        program2,
        context,
        119,
        beneficiary,
        tokenName,
        mint
      );

      // If we reach here, the test should fail
      fail("Expected transaction to fail due to insufficient tokens");
    } catch (error: any) {
      // Verify that the error matches PepeDropError::InsufficientUnlockedTokens
      expect(error.toString()).toContain("InsufficientUnlockedTokens");
    }
  });

  it("should create a token vault for okx", async () => {
    const tx = await program.methods
      .initializeTokenVaultForOkx(tokenName, new BN(totalAmount))
      .accounts({
        owner: creator.publicKey,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        sourceTokenAccount: creatorTokenAccount,
      })
      .rpc();

    const tokenVaultOkxAccountData = await program.account.tokenVault.fetch(
      tokenVaultOkxAccountKey,
      "confirmed"
    );

    console.log(tokenVaultOkxAccountData);
    expect(tokenVaultOkxAccountData.vaultName).toBe(tokenName);
    expect(tokenVaultOkxAccountData.totalTokens.toNumber()).toBe(totalAmount);
  });

  it("should send tokens to okx", async () => {
    const tx = await program.methods
      .sendTokensToOkx(new BN(claimAmount))
      .accounts({
        owner: creator.publicKey,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        destinationWallet: beneficiary.publicKey,
      })
      .rpc();
  });
});
