// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import PepedropIDL from '../target/idl/pepedrop.json'
import type { Pepedrop } from '../target/types/pepedrop'

// Re-export the generated IDL and type
export { Pepedrop, PepedropIDL }

// The programId is imported from the program IDL.
export const PEPEDROP_PROGRAM_ID = new PublicKey(PepedropIDL.address)

// This is a helper function to get the Pepedrop Anchor program.
export function getPepedropProgram(provider: AnchorProvider, address?: PublicKey) {
  return new Program({ ...PepedropIDL, address: address ? address.toBase58() : PepedropIDL.address } as Pepedrop, provider)
}

// This is a helper function to get the program ID for the Pepedrop program depending on the cluster.
export function getPepedropProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Pepedrop program on devnet and testnet.
      return new PublicKey('coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF')
    case 'mainnet-beta':
    default:
      return PEPEDROP_PROGRAM_ID
  }
}
