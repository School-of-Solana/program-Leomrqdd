import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import {
  createTransaction,
  getBase58Decoder,
  getProgramDerivedAddress,
  getBytesEncoder,
  getAddressEncoder,
  signAndSendTransactionMessageWithSigners,
} from 'gill'
import type { Address } from 'gill'
import {
  ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
  fetchMaybeVault,
  getCommitDrawInstructionAsync,
  getSettleDrawInstructionAsync,
} from '@/clients/generated'
import type { SolanaClient } from 'gill'
import {
  Orao,
  networkStateAccountAddress,
  randomnessAccountAddress,
} from "@orao-network/solana-vrf";

export function AdminSettleDraw({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [submitting, setSubmitting] = useState(false)
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)
  const [resolvedVault, setResolvedVault] = useState<string | null>(null)
  const [resolvedWinnerId, setResolvedWinnerId] = useState<string | null>(null)

  // Simple vault info for UI
  const [vaultInfo, setVaultInfo] = useState<{
    address: string
    locked: boolean
    participantCount: bigint
    drawn: boolean
    winnerId: bigint
    claimed: boolean
  } | null>(null)
  const [vaultLoading, setVaultLoading] = useState(false)

  async function refreshState() {
    try {
      if (!signer?.address) throw new Error('No signer')
      setVaultLoading(true)
      const [vaultAddr] = await getProgramDerivedAddress({
        programAddress: ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])),
          getAddressEncoder().encode(signer.address as any),
        ],
      })
      setResolvedVault(vaultAddr)
      const maybe = await fetchMaybeVault(client.rpc, vaultAddr as any)
      setVaultExists(maybe.exists)
      if (maybe.exists) {
        setVaultInfo({
          address: vaultAddr,
          locked: maybe.data.locked,
          participantCount: maybe.data.participantCount,
          drawn: maybe.data.drawn,
          winnerId: maybe.data.winnerId,
          claimed: maybe.data.claimed,
        })
        setResolvedWinnerId(maybe.data.drawn ? maybe.data.winnerId.toString() : null)
      } else {
        setVaultInfo(null)
        setResolvedWinnerId(null)
      }
    } catch {
      setVaultExists(null)
      setResolvedVault(null)
      setVaultInfo(null)
      setResolvedWinnerId(null)
    } finally {
      setVaultLoading(false)
    }
  }

  useEffect(() => {
    void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.address])

  const loadWinnerFromChain = useMemo(
    () => async (vaultAddr: string) => {
      try {
        const maybeVault = await fetchMaybeVault(client.rpc, vaultAddr as any)
        if (!maybeVault.exists) {
          setResolvedWinnerId(null)
          setVaultInfo(null)
          return
        }
        const wid = maybeVault.data.winnerId
        setResolvedWinnerId(wid.toString())
        setVaultInfo({
          address: vaultAddr,
          locked: maybeVault.data.locked,
          participantCount: maybeVault.data.participantCount,
          drawn: maybeVault.data.drawn,
          winnerId: maybeVault.data.winnerId,
          claimed: maybeVault.data.claimed,
        })
      } catch {
        setResolvedWinnerId(null)
        setVaultInfo(null)
      } finally {
        // no-op
      }
    },
    [client.rpc],
  )

  async function onSettle() {
    try {
      setSubmitting(true)
      // ORAO helpers and client
      
      // Use explicit Devnet connection for ORAO VRF reads to avoid wallet/provider issues
      // Remplace le bloc de connexion ORAO par:
      const { Connection } = await import('@solana/web3.js')
      const connection = new Connection('https://api.devnet.solana.com', { commitment: 'confirmed' })
      const vrf = new Orao({ connection } as any)


      // Variables alignées avec les tests
      const force = new Uint8Array(32)
      crypto.getRandomValues(force)
      const randomAddr = randomnessAccountAddress(force).toBase58()
      const configAddr = networkStateAccountAddress().toBase58()
      const networkState = await vrf.getNetworkState()
      const treasuryAddr: string = (networkState.config?.treasury ?? networkState.treasury).toBase58()

      // 1) Commit draw
      {
        const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
        const commitIx = await getCommitDrawInstructionAsync({
          vaultAuthority: signer,
          treasury: treasuryAddr as Address<string>,
          config: configAddr as Address<string>,
          random: randomAddr as Address<string>,
          force,
        })

        const tx = createTransaction({
          feePayer: signer,
          version: 0,
          latestBlockhash,
          instructions: [commitIx],
        })
        const bytes = await signAndSendTransactionMessageWithSigners(tx)
        //solve error here 
        const signature = getBase58Decoder().decode(bytes)
        toastTx(signature)
        // Track resolved vault for UI
        const vaultAddr = commitIx.accounts[1]!.address as string
        setResolvedVault(vaultAddr)
      }

      // 2) Wait for VRF fulfilment on devnet
      await vrf.waitFulfilled(force)

      console.log("ok fulfilled")

      // 3) Settle draw
      {
        const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
        const settleIx = await getSettleDrawInstructionAsync({
          vaultAuthority: signer,
          random: randomAddr as Address<string>,
        })
        console.log(settleIx)
        const tx = createTransaction({
          feePayer: signer,
          version: 0,
          latestBlockhash,
          instructions: [settleIx],
        })
        console.log(tx)
        const bytes = await signAndSendTransactionMessageWithSigners(tx)
        const signature = getBase58Decoder().decode(bytes)
        toastTx(signature)
        // After success, resolve winner info from chain.
        const vaultAddr = settleIx.accounts[1]!.address as string
        setResolvedVault(vaultAddr)
        await loadWinnerFromChain(vaultAddr)
      }
    } catch (err) {
      console.error(err)
      toast.error('Settle draw failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-lg font-medium">Settle Draw</div>
        <div className="text-sm text-muted-foreground">
          Finalizes the draw using ORAO VRF randomness. Requires the vault authority.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="sm:col-span-2">
          <Button onClick={onSettle} disabled={submitting || vaultExists === false} className="w-full sm:w-auto">
            {submitting ? 'Settling…' : 'Settle Draw'}
          </Button>
        </div>
        <div className="sm:col-span-2 space-y-1 text-sm">
          {vaultLoading ? (
            <div className="text-muted-foreground">Loading vault…</div>
          ) : vaultInfo ? (
            <>
              <div>Vault: {vaultInfo.address}</div>
              <div>Locked: {vaultInfo.locked ? 'Yes' : 'No'}</div>
              <div>Participants: {vaultInfo.participantCount.toString()}</div>
              <div>Drawn: {vaultInfo.drawn ? 'Yes' : 'No'}</div>
              <div>Winner ID: {vaultInfo.drawn ? vaultInfo.winnerId.toString() : '—'}</div>
              <div>Claimed: {vaultInfo.claimed ? 'Yes' : 'No'}</div>
            </>
          ) : (
            <div className="text-muted-foreground">No vault found for this authority.</div>
          )}
        </div>
      </div>
    </Card>
  )
}


