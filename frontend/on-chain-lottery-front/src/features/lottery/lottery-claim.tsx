import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { createTransaction, getBase58Decoder, signAndSendTransactionMessageWithSigners } from 'gill'
import { getClaimIfWinnerInstructionAsync } from '@/clients/generated'
import type { Address, SolanaClient } from 'gill'

export function LotteryClaim({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [authority, setAuthority] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  async function onClaim() {
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      const vaultAuthority = ((authority?.trim() ? authority.trim() : signer.address) ?? '') as Address
      const ix = await getClaimIfWinnerInstructionAsync({
        user: signer,
        vaultAuthority,
      })
      const tx = createTransaction({
        feePayer: signer,
        version: 0,
        latestBlockhash,
        instructions: [ix],
      })
      const sigBytes = await signAndSendTransactionMessageWithSigners(tx)
      const signature = getBase58Decoder().decode(sigBytes)
      toastTx(signature)
    } catch (err) {
      console.error(err)
      toast.error('Claim failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      <div className="space-y-1">
        <div className="text-lg font-medium">Claim if Winner</div>
        <div className="text-sm text-muted-foreground">
          If you are the winner, funds will be transferred to your wallet.
          <br />
          Requires the lottery to be settled before.
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="w-full">
          <label className="mb-1 block text-sm font-medium">Vault authority</label>
          <Input
            placeholder={signer?.address ?? 'Paste a wallet address (pubkey)'}
            value={authority}
            onChange={(e) => setAuthority(e.target.value)}
            className="max-w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={onClaim} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Claiming…' : 'Claim'}
          </Button>
        </div>
      </div>
    </Card>
  )
}


