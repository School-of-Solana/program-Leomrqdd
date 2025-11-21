import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { 
  createTransaction, 
  getBase58Decoder, 
  signAndSendTransactionMessageWithSigners,
  getBytesEncoder,
  getProgramDerivedAddress,
  getAddressEncoder
} from 'gill'
import { 
  ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
  getCloseParticipantInstruction
} from '@/clients/generated'
import type { Address, SolanaClient } from 'gill'

export function LotteryCloseParticipant({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [authority, setAuthority] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  async function onClose() {
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      const vaultAuthority = ((authority?.trim() ? authority.trim() : signer.address) ?? '') as Address
      
      // Derive vault PDA
      const [vaultPda] = await getProgramDerivedAddress({
        programAddress: ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
          getAddressEncoder().encode(vaultAuthority),
        ],
      })
      
      // Derive participant PDA
      const [participantPda] = await getProgramDerivedAddress({
        programAddress: ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([112, 97, 114, 116, 105, 99, 105, 112, 97, 110, 116])), // "participant"
          getAddressEncoder().encode(vaultPda),
          getAddressEncoder().encode(signer.address as Address),
        ],
      })
      
      const ix = getCloseParticipantInstruction({
        user: signer,
        participant: participantPda,
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
      toast.success('Participant account closed! Rent refunded to your wallet.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to close participant account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      <div className="space-y-1">
        <div className="text-lg font-medium">Close Participant Account</div>
        <div className="text-sm text-muted-foreground">
          Close your participant account to recover rent and participate in a new lottery.
          <br />
          You must close your account before you can deposit in a new lottery.
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
          <Button onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Closing…' : 'Close Account'}
          </Button>
        </div>
      </div>
    </Card>
  )
}



