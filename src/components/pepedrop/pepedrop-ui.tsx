"use client";

import { Keypair, PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import {
  usePepedropProgram,
  usePepedropProgramAccount,
} from "./pepedrop-data-access";

export function PepedropList() {
  const { getProgramAccount } = usePepedropProgram();

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>
          Program account not found. Make sure you have deployed the program and
          are on the correct cluster.
        </span>
      </div>
    );
  }
  return (
    <div className={"space-y-6"}>
      <div className="text-center">
        <h2 className={"text-2xl"}>No accounts</h2>
        No accounts found. Create one above to get started.
      </div>
    </div>
  );
}
