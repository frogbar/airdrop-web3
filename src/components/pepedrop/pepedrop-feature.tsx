"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../solana/solana-provider";
import { AppHero, ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import { usePepedropProgram } from "./pepedrop-data-access";
import { PepedropList, InitializeVaultModal, ClaimList } from "./pepedrop-ui";

export default function PepedropFeature() {
  const { publicKey } = useWallet();
  const { programId } = usePepedropProgram();
  const [showInitModal, setShowInitModal] = useState(false);

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
          <button
            className="btn btn-primary"
            onClick={() => setShowInitModal(true)}
          >
            Initialize Vault
          </button>
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
