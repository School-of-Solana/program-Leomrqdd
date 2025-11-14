import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import {
  createTransaction,
  getBase58Decoder,
  signAndSendTransactionMessageWithSigners,
  getProgramDerivedAddress,
  getBytesEncoder,
  getAddressEncoder,
} from 'gill'
import { getDepositInstructionAsync, ON_CHAIN_LOTTERY_PROGRAM_ADDRESS } from '@/clients/generated'
import type { Address, SolanaClient } from 'gill'

export function LotteryDeposit({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const [amountSol, setAmountSol] = useState<number>(0.1)
  const [authority, setAuthority] = useState<string>('') // target vault authority (pubkey)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const signer = useWalletUiSigner({ account })

  async function deriveVaultPdaForAuthority(authorityAddress: Address) {
    const [address] = await getProgramDerivedAddress({
      programAddress: ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
      seeds: [
        getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
        getAddressEncoder().encode(authorityAddress),
      ],
    })
    return address
  }

  async function onDeposit() {
    try {
      setSubmitting(true)
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()

      const targetAuthority = (authority?.trim()
        ? (authority.trim() as unknown as Address)
        : signer.address) as Address
      const vault = await deriveVaultPdaForAuthority(targetAuthority)
      const lamports = BigInt(Math.round((Number.isFinite(amountSol) ? amountSol : 0) * 1_000_000_000))

      const ix = await getDepositInstructionAsync({
        user: signer,
        vault,
        amount: lamports,
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
      toast.error('Deposit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      <div className="space-y-1">
        <div className="text-lg font-medium">Deposit</div>
        <div className="text-sm text-muted-foreground">
          Deposit SOL into any vault by specifying its authority address.
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
        <div className="w-full">
          <label className="mb-1 block text-sm font-medium">Amount (SOL)</label>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={amountSol}
            onChange={(e) => setAmountSol(parseFloat(e.target.value))}
            className="sm:max-w-[14rem]"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            onClick={onDeposit}
            disabled={submitting || !Number.isFinite(amountSol) || amountSol <= 0}
            className="w-full sm:w-auto"
          >
            {submitting ? 'Depositing…' : 'Deposit'}
          </Button>
        </div>
      </div>
    </Card>
  )
}


