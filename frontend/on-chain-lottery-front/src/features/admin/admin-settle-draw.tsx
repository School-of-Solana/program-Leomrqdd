import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { createTransaction, getBase58Decoder, signAndSendTransactionMessageWithSigners } from 'gill'
import { fetchMaybeVault, getSettleDrawInstructionAsync } from '@/clients/generated'
import type { SolanaClient } from 'gill'

export function AdminSettleDraw({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [submitting, setSubmitting] = useState(false)
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)
  const [winnerId, setWinnerId] = useState<number>(0)

  async function refreshState() {
    try {
      const ix = await getSettleDrawInstructionAsync({ vaultAuthority: signer, winnerId: BigInt(0) })
      const maybe = await fetchMaybeVault(client.rpc, ix.accounts[1]!.address as any)
      setVaultExists(maybe.exists)
    } catch {
      setVaultExists(null)
    }
  }

  useEffect(() => {
    void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.address])

  async function onSettle() {
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      const ix = await getSettleDrawInstructionAsync({
        vaultAuthority: signer,
        winnerId: BigInt(Math.max(0, Math.floor(isFinite(winnerId) ? winnerId : 0))),
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
          Finalizes the draw by selecting the provided winner id. Requires the vault authority.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="w-full">
          <label className="mb-1 block text-sm font-medium">Winner ID</label>
          <Input
            type="number"
            min="0"
            step="1"
            value={winnerId}
            onChange={(e) => setWinnerId(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={onSettle} disabled={submitting || vaultExists === false} className="w-full sm:w-auto">
            {submitting ? 'Settling…' : 'Settle Draw'}
          </Button>
        </div>
      </div>
    </Card>
  )
}


