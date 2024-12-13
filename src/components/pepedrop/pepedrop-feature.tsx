"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../solana/solana-provider";
import { AppHero, ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import { usePepedropProgram } from "./pepedrop-data-access";
import {
  PepedropList,
  InitializeVaultModal,
  ClaimList,
  InitializeOkxVaultModal,
} from "./pepedrop-ui";

export default function PepedropFeature() {
  const { publicKey } = useWallet();
  const { programId } = usePepedropProgram();
  const [showInitModal, setShowInitModal] = useState(false);
  const [showOkxInitModal, setShowOkxInitModal] = useState(false);

  return publicKey ? (
    <div>
      <AppHero
        title="Pepedrop"
        subtitle={
          'Create a new token vault by clicking the "Initialize Vault" button. The vault will store tokens that can be claimed by users.'
        }
      >
        <div className="space-y-4">
          <p className="mb-6">
            <ExplorerLink
              path={`account/${programId}`}
              label={ellipsify(programId.toString())}
            />
          </p>
          <div className="space-x-4">
            <button
              className="btn btn-primary bg-[#641AE6] hover:bg-[#4F15B3]"
              onClick={() => setShowInitModal(true)}
            >
              Initialize Vault
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowOkxInitModal(true)}
            >
              Initialize OKX Vault
            </button>
          </div>
        </div>
      </AppHero>
      <div className="space-y-8">
        <PepedropList />
        <ClaimList />
      </div>
      <InitializeVaultModal
        show={showInitModal}
        hide={() => setShowInitModal(false)}
      />
      <InitializeOkxVaultModal
        show={showOkxInitModal}
        hide={() => setShowOkxInitModal(false)}
      />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  );
}
