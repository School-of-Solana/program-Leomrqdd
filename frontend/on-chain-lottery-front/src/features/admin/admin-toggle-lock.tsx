import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import {
  createTransaction,
  getBase58Decoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  getAddressEncoder,
  signAndSendTransactionMessageWithSigners,
} from 'gill'
import { getToggleLockInstruction, fetchMaybeVault, ON_CHAIN_LOTTERY_PROGRAM_ADDRESS } from '@/clients/generated'
import type { Address, SolanaClient } from 'gill'

export function AdminToggleLock({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState<boolean | null>(null)
  const [vaultAddress, setVaultAddress] = useState<Address | null>(null)

  const authorityAddress = signer.address as Address

  const deriveVaultPda = useMemo(
    () => async (authority: Address) => {
      const [address] = await getProgramDerivedAddress({
        programAddress: ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
          getAddressEncoder().encode(authority),
        ],
      })
      return address
    },
    [],
  )

  async function refreshState() {
    try {
      const vault = await deriveVaultPda(authorityAddress)
      setVaultAddress(vault)
      const maybe = await fetchMaybeVault(client.rpc, vault)
      setLocked(maybe.exists ? maybe.data.locked : null)
    } catch {
      setLocked(null)
    }
  }

  useEffect(() => {
    void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorityAddress])

  async function onToggle() {
    if (!vaultAddress) {
      toast.error('Vault not found. Initialize it first.')
      return
    }
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      const ix = getToggleLockInstruction({
        vaultAuthority: signer,
        vault: vaultAddress,
      })
      const tx = createTransaction({
        feePayer: signer,
        version: 0,
        latestBlockhash,
        instructions: [ix],
      })
      const bytes = await signAndSendTransactionMessageWithSigners(tx)
      const signature = getBase58Decoder().decode(bytes)
      toastTx(signature)
      await refreshState()
    } catch (err) {
      console.error(err)
      toast.error('Toggle failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-lg font-medium">Toggle Lock</div>
        <div className="text-sm text-muted-foreground">
          Vault authority can lock/unlock their vault. Current:{' '}
          <b>{locked === null ? 'Not initialized' : locked ? 'Locked' : 'Unlocked'}</b>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onToggle} disabled={submitting || locked === null} className="w-full sm:w-auto">
          {submitting ? 'Toggling…' : locked ? 'Unlock' : 'Lock'}
        </Button>
      </div>
    </Card>
  )
}


