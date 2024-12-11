import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Keypair} from '@solana/web3.js'
import {Pepedrop} from '../target/types/pepedrop'

describe('pepedrop', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const payer = provider.wallet as anchor.Wallet

  const program = anchor.workspace.Pepedrop as Program<Pepedrop>

  const pepedropKeypair = Keypair.generate()

  it('Initialize Pepedrop', async () => {
    await program.methods
      .initialize()
      .accounts({
        pepedrop: pepedropKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([pepedropKeypair])
      .rpc()

    const currentCount = await program.account.pepedrop.fetch(pepedropKeypair.publicKey)

    expect(currentCount.count).toEqual(0)
  })

  it('Increment Pepedrop', async () => {
    await program.methods.increment().accounts({ pepedrop: pepedropKeypair.publicKey }).rpc()

    const currentCount = await program.account.pepedrop.fetch(pepedropKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Increment Pepedrop Again', async () => {
    await program.methods.increment().accounts({ pepedrop: pepedropKeypair.publicKey }).rpc()

    const currentCount = await program.account.pepedrop.fetch(pepedropKeypair.publicKey)

    expect(currentCount.count).toEqual(2)
  })

  it('Decrement Pepedrop', async () => {
    await program.methods.decrement().accounts({ pepedrop: pepedropKeypair.publicKey }).rpc()

    const currentCount = await program.account.pepedrop.fetch(pepedropKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Set pepedrop value', async () => {
    await program.methods.set(42).accounts({ pepedrop: pepedropKeypair.publicKey }).rpc()

    const currentCount = await program.account.pepedrop.fetch(pepedropKeypair.publicKey)

    expect(currentCount.count).toEqual(42)
  })

  it('Set close the pepedrop account', async () => {
    await program.methods
      .close()
      .accounts({
        payer: payer.publicKey,
        pepedrop: pepedropKeypair.publicKey,
      })
      .rpc()

    // The account should no longer exist, returning null.
    const userAccount = await program.account.pepedrop.fetchNullable(pepedropKeypair.publicKey)
    expect(userAccount).toBeNull()
  })
})
