// src/components/pepedrop/pepedrop-ui.tsx
"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  getTokenProgramId,
  usePepedropProgram,
  usePepedropProgramAccount,
} from "./pepedrop-data-access";
import { AppModal } from "../ui/ui-layout";
import { useConnection } from "@solana/wallet-adapter-react";
import { getMint as getSolanaMint } from "@solana/spl-token";

const getMint = async (connection: Connection, mint: PublicKey) => {
  const tokenProgramId = await getTokenProgramId(connection, mint);
  return getSolanaMint(connection, mint, "confirmed", tokenProgramId);
};

export function InitializeVaultModal({
  show,
  hide,
}: {
  show: boolean;
  hide: () => void;
}) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { initializeTokenVault } = usePepedropProgram();
  const [vaultName, setVaultName] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [totalTokens, setTotalTokens] = useState("");
  const [mintInfo, setMintInfo] = useState<{ decimals: number } | null>(null);

  useEffect(() => {
    const getMintInfo = async () => {
      if (!mintAddress) {
        setMintInfo(null);
        return;
      }
      try {
        const mint = new PublicKey(mintAddress);
        const mintAccount = await getMint(connection, mint);
        setMintInfo(mintAccount);
      } catch (error) {
        console.error("Error fetching mint info:", error);
        setMintInfo(null);
      }
    };
    getMintInfo();
  }, [connection, mintAddress]);

  const handleSubmit = async () => {
    try {
      if (!mintInfo) throw new Error("Mint info not loaded");

      const mint = new PublicKey(mintAddress);
      const rawAmount = parseFloat(totalTokens);
      const adjustedAmount = rawAmount * Math.pow(10, mintInfo.decimals);

      await initializeTokenVault.mutateAsync({
        mint,
        owner: publicKey!,
        vaultName,
        totalTokens: new BN(adjustedAmount),
      });
      hide();
    } catch (error) {
      console.error("Error creating token vault:", error);
    }
  };

  return (
    <AppModal
      title="Initialize Token Vault"
      show={show}
      hide={hide}
      submit={handleSubmit}
      submitDisabled={
        !vaultName ||
        !mintAddress ||
        !totalTokens ||
        initializeTokenVault.isPending
      }
      submitLabel="Create Vault"
    >
      <div className="space-y-4">
        <div>
          <label className="label">
            <span className="label-text">Vault Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="Enter vault name"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Mint Address</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            placeholder="Enter token mint address"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Total Tokens</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={totalTokens}
            onChange={(e) => setTotalTokens(e.target.value)}
            placeholder="Enter total tokens"
          />
        </div>
      </div>
    </AppModal>
  );
}

export function CreateClaimModal({
  show,
  hide,
  mint,
}: {
  show: boolean;
  hide: () => void;
  mint: PublicKey;
}) {
  const { publicKey } = useWallet();
  const { createClaim } = usePepedropProgramAccount({ account: publicKey! });
  const { connection } = useConnection();
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [totalTokens, setTotalTokens] = useState("");
  const [mintInfo, setMintInfo] = useState<{ decimals: number } | null>(null);

  useEffect(() => {
    const getMintInfo = async () => {
      try {
        const mintAccount = await getMint(connection, mint);
        setMintInfo(mintAccount);
      } catch (error) {
        console.error("Error fetching mint info:", error);
      }
    };
    getMintInfo();
  }, [connection, mint]);

  const handleSubmit = async () => {
    try {
      if (!mintInfo) throw new Error("Mint info not loaded");

      const beneficiary = new PublicKey(beneficiaryAddress);
      const rawAmount = parseFloat(totalTokens);
      const adjustedAmount = rawAmount * Math.pow(10, mintInfo.decimals);

      await createClaim.mutateAsync({
        mint,
        beneficiary,
        totalTokens: new BN(adjustedAmount),
      });
      hide();
    } catch (error) {
      console.error("Error creating claim:", error);
    }
  };

  return (
    <AppModal
      title="Create Claim"
      show={show}
      hide={hide}
      submit={handleSubmit}
      submitDisabled={
        createClaim.isPending ||
        !beneficiaryAddress ||
        !totalTokens ||
        !mintInfo
      }
      submitLabel="Create Claim"
    >
      <div className="space-y-4">
        <div>
          <label className="label">
            <span className="label-text">Beneficiary Wallet Address</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={beneficiaryAddress}
            onChange={(e) => setBeneficiaryAddress(e.target.value)}
            placeholder="Enter wallet address for the claim"
          />
        </div>
        <div>
          <label className="label">
            <span className="label-text">Total Tokens</span>
          </label>
          <input
            type="number"
            step="any"
            className="input input-bordered w-full"
            value={totalTokens}
            onChange={(e) => setTotalTokens(e.target.value)}
            placeholder={`Enter amount (${
              mintInfo?.decimals ?? "..."
            } decimals)`}
          />
        </div>
        <p className="text-sm text-gray-500">Mint: {mint.toString()}</p>
      </div>
    </AppModal>
  );
}

export function PepedropList() {
  const { ownedTokenVaults } = usePepedropProgram();
  const { connection } = useConnection();
  const [selectedMint, setSelectedMint] = useState<PublicKey | null>(null);
  const [mintInfos, setMintInfos] = useState<
    Record<string, { decimals: number }>
  >({});

  useEffect(() => {
    const loadMintInfos = async () => {
      if (!ownedTokenVaults.data) return;

      const infos: Record<string, { decimals: number }> = {};
      for (const vault of ownedTokenVaults.data) {
        try {
          const mintInfo = await getMint(connection, vault.account.mint);
          infos[vault.account.mint.toString()] = mintInfo;
        } catch (error) {
          console.error("Error loading mint info:", error);
        }
      }
      setMintInfos(infos);
    };

    loadMintInfos();
  }, [connection, ownedTokenVaults.data]);

  return (
    <div className="container mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Your Token Vaults</h2>
      {ownedTokenVaults.data?.map((vault) => {
        const mintInfo = mintInfos[vault.account.mint.toString()];
        return (
          <div
            key={vault.publicKey.toString()}
            className="card bg-base-200 mb-4 p-4"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold">{vault.account.vaultName}</h3>
                <p>
                  Total Tokens:{" "}
                  {mintInfo
                    ? formatTokenAmount(
                        vault.account.totalTokens,
                        mintInfo.decimals
                      )
                    : vault.account.totalTokens.toString()}
                </p>
                <p className="text-sm text-gray-500">
                  Mint: {vault.account.mint.toString()}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedMint(vault.account.mint)}
              >
                Create Claim
              </button>
            </div>
          </div>
        );
      })}

      {selectedMint && (
        <CreateClaimModal
          show={!!selectedMint}
          hide={() => setSelectedMint(null)}
          mint={selectedMint}
        />
      )}
    </div>
  );
}

export function ClaimList() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { availableClaims, claimDrop } = usePepedropProgramAccount({
    account: publicKey!,
  });
  const [mintInfos, setMintInfos] = useState<
    Record<string, { decimals: number }>
  >({});

  useEffect(() => {
    const loadMintInfos = async () => {
      if (!availableClaims.data) return;

      const infos: Record<string, { decimals: number }> = {};
      for (const claim of availableClaims.data) {
        try {
          const mintInfo = await getMint(connection, claim.account.mint);
          infos[claim.account.mint.toString()] = mintInfo;
        } catch (error) {
          console.error("Error loading mint info:", error);
        }
      }
      setMintInfos(infos);
    };

    loadMintInfos();
  }, [connection, availableClaims.data]);

  const handleClaim = async (mint: PublicKey) => {
    try {
      await claimDrop.mutateAsync({ mint });
    } catch (error) {
      console.error("Error claiming tokens:", error);
    }
  };

  return (
    <div className="container mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Available Claims</h2>
      {availableClaims.isLoading ? (
        <div>Loading claims...</div>
      ) : availableClaims.data?.length ? (
        <div className="space-y-4">
          {availableClaims.data.map((claim) => {
            const mintInfo = mintInfos[claim.account.mint.toString()];
            return (
              <div
                key={claim.publicKey.toString()}
                className="card bg-base-200 p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p>Claim Account: {claim.publicKey.toString()}</p>
                    <p>
                      Total Tokens:{" "}
                      {mintInfo
                        ? formatTokenAmount(
                            claim.account.totalTokens,
                            mintInfo.decimals
                          )
                        : claim.account.totalTokens.toString()}
                    </p>
                    <p>
                      Tokens Claimed:{" "}
                      {mintInfo
                        ? formatTokenAmount(
                            claim.account.tokensClaimed,
                            mintInfo.decimals
                          )
                        : claim.account.tokensClaimed.toString()}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleClaim(claim.account.mint)}
                    disabled={claimDrop.isPending}
                  >
                    {claimDrop.isPending ? "Claiming..." : "Claim Tokens"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>No claims available</div>
      )}
    </div>
  );
}

function formatTokenAmount(amount: BN, decimals: number): string {
  const rawAmount = amount.toNumber();
  return (rawAmount / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function InitializeOkxVaultModal({
  show,
  hide,
}: {
  show: boolean;
  hide: () => void;
}) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { initializeOkxTokenVault } = usePepedropProgram();
  const [vaultName, setVaultName] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [totalTokens, setTotalTokens] = useState("");
  const [mintInfo, setMintInfo] = useState<{ decimals: number } | null>(null);

  useEffect(() => {
    const getMintInfo = async () => {
      if (!mintAddress) {
        setMintInfo(null);
        return;
      }
      try {
        const mint = new PublicKey(mintAddress);
        const mintAccount = await getMint(connection, mint);
        setMintInfo(mintAccount);
      } catch (error) {
        console.error("Error fetching mint info:", error);
        setMintInfo(null);
      }
    };
    getMintInfo();
  }, [connection, mintAddress]);

  const handleSubmit = async () => {
    try {
      if (!mintInfo) throw new Error("Mint info not loaded");

      const mint = new PublicKey(mintAddress);
      const rawAmount = parseFloat(totalTokens);
      const adjustedAmount = rawAmount * Math.pow(10, mintInfo.decimals);

      await initializeOkxTokenVault.mutateAsync({
        mint,
        owner: publicKey!,
        vaultName,
        totalTokens: new BN(adjustedAmount),
      });
      hide();
    } catch (error) {
      console.error("Error creating OKX token vault:", error);
    }
  };

  return (
    <AppModal
      title="Initialize OKX Token Vault"
      show={show}
      hide={hide}
      submit={handleSubmit}
      submitDisabled={
        !vaultName ||
        !mintAddress ||
        !totalTokens ||
        initializeOkxTokenVault.isPending
      }
      submitLabel="Create OKX Vault"
    >
      <div className="space-y-4">
        <div>
          <label className="label">
            <span className="label-text">Vault Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="Enter vault name"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Mint Address</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            placeholder="Enter token mint address"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Total Tokens</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={totalTokens}
            onChange={(e) => setTotalTokens(e.target.value)}
            placeholder="Enter total tokens"
          />
        </div>
      </div>
    </AppModal>
  );
}
