'use client'

import { getPepedropProgram, getPepedropProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'

export function usePepedropProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getPepedropProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getPepedropProgram(provider, programId), [provider, programId])

  const accounts = useQuery({
    queryKey: ['pepedrop', 'all', { cluster }],
    queryFn: () => program.account.pepedrop.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initialize = useMutation({
    mutationKey: ['pepedrop', 'initialize', { cluster }],
    mutationFn: (keypair: Keypair) =>
      program.methods.initialize().accounts({ pepedrop: keypair.publicKey }).signers([keypair]).rpc(),
    onSuccess: (signature) => {
      transactionToast(signature)
      return accounts.refetch()
    },
    onError: () => toast.error('Failed to initialize account'),
  })

  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    initialize,
  }
}

export function usePepedropProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts } = usePepedropProgram()

  const accountQuery = useQuery({
    queryKey: ['pepedrop', 'fetch', { cluster, account }],
    queryFn: () => program.account.pepedrop.fetch(account),
  })

  const closeMutation = useMutation({
    mutationKey: ['pepedrop', 'close', { cluster, account }],
    mutationFn: () => program.methods.close().accounts({ pepedrop: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accounts.refetch()
    },
  })

  const decrementMutation = useMutation({
    mutationKey: ['pepedrop', 'decrement', { cluster, account }],
    mutationFn: () => program.methods.decrement().accounts({ pepedrop: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const incrementMutation = useMutation({
    mutationKey: ['pepedrop', 'increment', { cluster, account }],
    mutationFn: () => program.methods.increment().accounts({ pepedrop: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const setMutation = useMutation({
    mutationKey: ['pepedrop', 'set', { cluster, account }],
    mutationFn: (value: number) => program.methods.set(value).accounts({ pepedrop: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  return {
    accountQuery,
    closeMutation,
    decrementMutation,
    incrementMutation,
    setMutation,
  }
}
