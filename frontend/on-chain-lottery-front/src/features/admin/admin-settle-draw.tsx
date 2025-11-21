import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  const [committing, setCommitting] = useState(false)
  const [settling, setSettling] = useState(false)
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)

  // Store the force seed and random address for settle step
  const [commitData, setCommitData] = useState<{
    force: Uint8Array
    randomAddr: string
    configAddr: string
  } | null>(null)
  const [vrfFulfilled, setVrfFulfilled] = useState(false)
  const [checkingVrf, setCheckingVrf] = useState(false)

  // Simple vault info for UI
  const [vaultInfo, setVaultInfo] = useState<{
    address: string
    locked: boolean
    participantCount: bigint
    balance: bigint
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
          getAddressEncoder().encode(signer.address as Address),
        ],
      })
      const maybe = await fetchMaybeVault(client.rpc, vaultAddr as Address)
      setVaultExists(maybe.exists)
      if (maybe.exists) {
        // Get vault balance
        const balanceResult = await client.rpc.getBalance(vaultAddr as Address, { commitment: 'confirmed' }).send()
        const balance = balanceResult.value
        
        setVaultInfo({
          address: vaultAddr,
          locked: maybe.data.locked,
          participantCount: maybe.data.participantCount,
          balance,
          drawn: maybe.data.drawn,
          winnerId: maybe.data.winnerId,
          claimed: maybe.data.claimed,
        })
      } else {
        setVaultInfo(null)
      }
    } catch {
      setVaultExists(null)
      setVaultInfo(null)
    } finally {
      setVaultLoading(false)
    }
  }

  useEffect(() => {
    void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.address])

  // Poll VRF status while waiting for fulfillment
  useEffect(() => {
    if (!commitData || vrfFulfilled) return
    
    const interval = setInterval(() => {
      void checkVrfStatus()
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitData, vrfFulfilled])

  const loadWinnerFromChain = useMemo(
    () => async (vaultAddr: string) => {
      try {
        const maybeVault = await fetchMaybeVault(client.rpc, vaultAddr as Address)
        if (!maybeVault.exists) {
          setVaultInfo(null)
          return
        }
        
        // Get vault balance
        const balanceResult = await client.rpc.getBalance(vaultAddr as Address, { commitment: 'confirmed' }).send()
        const balance = balanceResult.value
        
        setVaultInfo({
          address: vaultAddr,
          locked: maybeVault.data.locked,
          participantCount: maybeVault.data.participantCount,
          balance,
          drawn: maybeVault.data.drawn,
          winnerId: maybeVault.data.winnerId,
          claimed: maybeVault.data.claimed,
        })
      } catch {
        setVaultInfo(null)
      } finally {
        // no-op
      }
    },
    [client.rpc],
  )

  async function checkVrfStatus() {
    if (!commitData) return
    try {
      setCheckingVrf(true)
      const { Connection, PublicKey } = await import('@solana/web3.js')
      const connection = new Connection('https://api.devnet.solana.com', { commitment: 'confirmed' })
      
      // Try to fetch the randomness account directly
      const randomPubkey = new PublicKey(commitData.randomAddr)
      const accountInfo = await connection.getAccountInfo(randomPubkey)
      
      if (!accountInfo) {
        console.log('Randomness account not found yet')
        setVrfFulfilled(false)
        return
      }
      
      // Check if the account has data (fulfilled randomness will have 64+ bytes)
      // The randomness data is stored at offset 8 (discriminator) and is 64 bytes
      const hasData = accountInfo.data.length >= 72
      
      if (hasData) {
        // Check if the randomness data is not all zeros (unfulfilled)
        const randomnessData = accountInfo.data.slice(8, 72)
        const isFulfilled = randomnessData.some(byte => byte !== 0)
        console.log('VRF fulfilled:', isFulfilled)
        setVrfFulfilled(isFulfilled)
      } else {
        console.log('Account exists but no randomness data yet')
        setVrfFulfilled(false)
      }
    } catch (err) {
      console.error('Error checking VRF status:', err)
      setVrfFulfilled(false)
    } finally {
      setCheckingVrf(false)
    }
  }

  async function onCommit() {
    try {
      setCommitting(true)
      const { Connection } = await import('@solana/web3.js')
      const connection = new Connection('https://api.devnet.solana.com', { commitment: 'confirmed' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vrf = new Orao({ connection } as any)

      // Generate random seed
      const force = new Uint8Array(32)
      crypto.getRandomValues(force)
      const randomAddr = randomnessAccountAddress(force).toBase58()
      const configAddr = networkStateAccountAddress().toBase58()
      const networkState = await vrf.getNetworkState()
      const treasuryAddr: string = networkState.config.treasury.toBase58()

      // Commit draw transaction
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
      const signature = getBase58Decoder().decode(bytes)
      toastTx(signature)
      
      // Save commit data for settle step
      setCommitData({ force, randomAddr, configAddr })
      
      toast.success('Draw committed! Wait for VRF fulfillment before settling.')
      
      // Start checking VRF status
      setTimeout(() => checkVrfStatus(), 3000)
    } catch (err) {
      console.error(err)
      toast.error('Commit draw failed')
    } finally {
      setCommitting(false)
    }
  }

  async function onSettle() {
    if (!commitData) {
      toast.error('Must commit draw first')
      return
    }

    try {
      setSettling(true)
      
      // Settle draw transaction
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      const settleIx = await getSettleDrawInstructionAsync({
        vaultAuthority: signer,
        random: commitData.randomAddr as Address<string>,
      })
      
      const tx = createTransaction({
        feePayer: signer,
        version: 0,
        latestBlockhash,
        instructions: [settleIx],
      })
      const bytes = await signAndSendTransactionMessageWithSigners(tx)
      const signature = getBase58Decoder().decode(bytes)
      toastTx(signature)
      
      // Refresh vault info to show winner
      const vaultAddr = settleIx.accounts[1]!.address as string
      await loadWinnerFromChain(vaultAddr)
      
      // Reset commit data
      setCommitData(null)
      setVrfFulfilled(false)
      
      toast.success('Draw settled successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Settle draw failed')
    } finally {
      setSettling(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-lg font-medium">Settle Draw</div>
        <div className="text-sm text-muted-foreground">
          Step 1: Commit the draw using ORAO VRF. Step 2: Settle once VRF is fulfilled.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="sm:col-span-2 flex gap-2 flex-wrap">
          <Button 
            onClick={onCommit} 
            disabled={committing || vaultExists === false || !!commitData} 
            className="w-full sm:w-auto"
            variant="default"
          >
            {committing ? 'Committing…' : 'Step 1: Commit Draw'}
          </Button>
          <Button 
            onClick={onSettle} 
            disabled={settling || !commitData || !vrfFulfilled} 
            className="w-full sm:w-auto"
            variant={vrfFulfilled ? 'default' : 'secondary'}
          >
            {settling ? 'Settling…' : 'Step 2: Settle Draw'}
          </Button>
          {commitData && !vrfFulfilled && (
            <Button 
              onClick={checkVrfStatus} 
              disabled={checkingVrf} 
              className="w-full sm:w-auto"
              variant="outline"
              size="sm"
            >
              {checkingVrf ? 'Checking…' : 'Check VRF Status'}
            </Button>
          )}
        </div>
        
        {/* VRF Status */}
        {commitData && (
          <div className="sm:col-span-2 p-3 bg-muted rounded-md space-y-1 text-sm">
            <div className="font-medium">VRF Status</div>
            <div className="text-muted-foreground">
              Random Address: <span className="font-mono text-xs">{commitData.randomAddr}</span>
            </div>
            <div className={vrfFulfilled ? 'text-green-600 font-medium' : 'text-orange-600'}>
              {vrfFulfilled ? '✓ VRF Fulfilled - Ready to settle!' : '⏳ Waiting for VRF fulfillment...'}
            </div>
          </div>
        )}

        {/* Vault Info */}
        <div className="sm:col-span-2 space-y-1 text-sm">
          {vaultLoading ? (
            <div className="text-muted-foreground">Loading vault…</div>
          ) : vaultInfo ? (
            <>
              <div className="font-medium mb-2">Vault Information</div>
              <div>Vault: <span className="font-mono text-xs">{vaultInfo.address}</span></div>
              <div>Amount to win: {(Number(vaultInfo.balance) / 1_000_000_000).toFixed(4)} SOL</div>
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


