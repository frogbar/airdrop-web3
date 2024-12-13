"use client";

import { getPepedropProgram, getPepedropProgramId } from "@project/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { useCluster } from "../cluster/cluster-data-access";
import { useAnchorProvider } from "../solana/solana-provider";
import { useTransactionToast } from "../ui/ui-layout";
import { BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

type InitializeTokenVaultParams = {
  mint: PublicKey;
  owner: PublicKey;
  vaultName: string;
  totalTokens: BN;
};

export async function getTokenProgramId(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  try {
    // Try to get the token account using Token-2022 program first
    const token2022Account = await connection.getAccountInfo(mint, "confirmed");
    if (
      token2022Account &&
      token2022Account.owner.equals(TOKEN_2022_PROGRAM_ID)
    ) {
      return TOKEN_2022_PROGRAM_ID;
    }

    // Try regular Token program
    const tokenAccount = await connection.getAccountInfo(mint, "confirmed");
    if (tokenAccount && tokenAccount.owner.equals(TOKEN_PROGRAM_ID)) {
      return TOKEN_PROGRAM_ID;
    }

    throw new Error("Invalid token mint account");
  } catch (e) {
    console.log("Error checking token program:", e);
    // Default to regular Token program
    return TOKEN_PROGRAM_ID;
  }
}

export function usePepedropProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const { publicKey } = useWallet();
  const transactionToast = useTransactionToast();
  const provider = useAnchorProvider();
  const programId = useMemo(
    () => getPepedropProgramId(cluster.network as Cluster),
    [cluster]
  );
  const program = useMemo(
    () => getPepedropProgram(provider, programId),
    [provider, programId]
  );

  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  const ownedTokenVaults = useQuery({
    queryKey: ["pepedrop", "owned-vaults", { cluster, account: publicKey }],
    queryFn: () =>
      program.account.tokenVault.all([
        {
          memcmp: {
            offset: 8, // Skip account discriminator
            bytes: publicKey?.toBase58() ?? "", // Filter by owner field
          },
        },
      ]),
    enabled: !!publicKey,
  });

  const initializeTokenVault = useMutation<
    string,
    Error,
    InitializeTokenVaultParams
  >({
    mutationKey: ["pepedrop", "initialize-token-vault", { cluster }],
    mutationFn: async ({ mint, vaultName, totalTokens }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tokenProgramId = await getTokenProgramId(connection, mint);

      // Get the associated token account for the wallet and mint
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mint,
        publicKey,
        false, // allowOwnerOffCurve
        tokenProgramId // Specify the token program ID
      );

      // Check if the token account exists
      const accountInfo = await connection.getAccountInfo(sourceTokenAccount);
      if (!accountInfo) {
        throw new Error(
          "Token account not initialized. Please create a token account first."
        );
      }

      console.log("Initializing token vault", {
        vaultName,
        totalTokens,
        mint,
        publicKey,
        tokenProgramId,
        sourceTokenAccount,
      });

      return program.methods
        .initializeTokenVault(vaultName, totalTokens)
        .accounts({
          owner: publicKey,
          mint: mint,
          tokenProgram: tokenProgramId,
          sourceTokenAccount,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      return ownedTokenVaults.refetch();
    },
    onError: (error) => {
      console.error("Initialize vault error:", error);
      toast.error(`Failed to initialize token vault: ${error.message}`);
    },
  });

  const initializeOkxTokenVault = useMutation<
    string,
    Error,
    InitializeTokenVaultParams
  >({
    mutationKey: ["pepedrop", "initialize-okx-token-vault", { cluster }],
    mutationFn: async ({ mint, vaultName, totalTokens }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tokenProgramId = await getTokenProgramId(connection, mint);

      // Get the associated token account for the wallet and mint
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mint,
        publicKey,
        false, // allowOwnerOffCurve
        tokenProgramId // Specify the token program ID
      );

      // Check if the token account exists
      const accountInfo = await connection.getAccountInfo(sourceTokenAccount);
      if (!accountInfo) {
        throw new Error(
          "Token account not initialized. Please create a token account first."
        );
      }

      console.log("Initializing okx token vault", {
        vaultName,
        totalTokens,
        mint,
        publicKey,
        tokenProgramId,
        sourceTokenAccount,
      });

      return program.methods
        .initializeTokenVaultForOkx(vaultName, totalTokens)
        .accounts({
          owner: publicKey,
          mint: mint,
          tokenProgram: tokenProgramId,
          sourceTokenAccount,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      return ownedTokenVaults.refetch();
    },
    onError: (error) => {
      console.error("Initialize okx vault error:", error);
      toast.error(`Failed to initialize okx token vault: ${error.message}`);
    },
  });

  return {
    connection,
    program,
    programId,
    getProgramAccount,
    ownedTokenVaults,
    initializeTokenVault,
    initializeOkxTokenVault,
    publicKey,
  };
}

export function usePepedropProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const { program, publicKey, connection } = usePepedropProgram();

  interface CreateClaimParams {
    mint: PublicKey;
    beneficiary: PublicKey;
    totalTokens: BN;
  }

  const createClaim = useMutation<string, Error, CreateClaimParams>({
    mutationKey: ["pepedrop", "create-claim", { cluster }],
    mutationFn: async ({ mint, beneficiary, totalTokens }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tokenProgramId = await getTokenProgramId(connection, mint);

      console.log("claiming drop", {
        mint,
        publicKey,
        tokenProgramId,
      });

      return program.methods
        .createClaimAccount(totalTokens)
        .accounts({
          signer: publicKey,
          beneficiary: beneficiary,
          mint: mint,
          tokenProgram: tokenProgramId,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      return availableClaims.refetch();
    },
    onError: (error) => {
      console.error("claim Tokens error:", error);
      toast.error(`Failed to claim tokens: ${error.message}`);
    },
  });

  const availableClaims = useQuery({
    queryKey: ["pepedrop", "available-claims", { cluster, account: publicKey }],
    queryFn: () =>
      program.account.claimAccount.all([
        {
          memcmp: {
            offset: 8, // Skip account discriminator
            bytes: publicKey?.toBase58() ?? "", // Filter by owner field
          },
        },
      ]),
    enabled: !!publicKey,
  });

  interface ClaimDropParams {
    mint: PublicKey;
  }

  const claimDrop = useMutation<string, Error, ClaimDropParams>({
    mutationKey: ["pepedrop", "initialize-token-vault", { cluster }],
    mutationFn: async ({ mint }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tokenProgramId = await getTokenProgramId(connection, mint);

      console.log("claiming drop", {
        mint,
        publicKey,
        tokenProgramId,
      });

      return program.methods
        .claimTokens()
        .accounts({
          mint: mint,
          tokenProgram: tokenProgramId,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      return availableClaims.refetch();
    },
    onError: (error) => {
      console.error("claim Tokens error:", error);
      toast.error(`Failed to claim tokens: ${error.message}`);
    },
  });

  return {
    availableClaims,
    claimDrop,
    createClaim,
  };
}
