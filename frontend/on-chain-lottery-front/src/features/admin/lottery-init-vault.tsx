import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { createTransaction, getBase58Decoder, signAndSendTransactionMessageWithSigners } from 'gill'
import { getInitVaultInstructionAsync } from '@/clients/generated'
import type { SolanaClient } from 'gill'

export function LotteryInitVault({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const [submitting, setSubmitting] = useState<boolean>(false)
  const signer = useWalletUiSigner({ account })

  async function onInitVault() {
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()

      const ix = await getInitVaultInstructionAsync({
        vaultAuthority: signer,
        locked: false,
      })

      const tx = createTransaction({
        feePayer: signer,
        version: 0,
        latestBlockhash,
        instructions: [ix],
      })

      const signatureBytes = await signAndSendTransactionMessageWithSigners(tx)
      const signature = getBase58Decoder().decode(signatureBytes)
      toastTx(signature)
    } catch (err) {
      console.error(err)
      toast.error('Transaction failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      <div className="space-y-1">
        <div className="text-lg font-medium">Initialize Vault</div>
        <div className="text-sm text-muted-foreground">
          Derives the vault PDA and initializes it. Requires a connected wallet.
        </div>
      </div>
      <div>
        <Button onClick={onInitVault} disabled={submitting} className="w-full sm:w-auto">
          {submitting ? 'Initializing…' : 'Initialize Vault'}
        </Button>
      </div>
    </Card>
  )
}


