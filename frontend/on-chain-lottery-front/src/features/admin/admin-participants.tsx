import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import type { Address, SolanaClient, Base58EncodedBytes } from 'gill'
import {
  getBytesEncoder,
  getProgramDerivedAddress,
  getAddressEncoder,
  getBase58Decoder,
} from 'gill'
import {
  ON_CHAIN_LOTTERY_PROGRAM_ADDRESS,
  fetchMaybeParticipant,
  getParticipantDiscriminatorBytes,
  fetchMaybeVault,
} from '@/clients/generated'

type ParticipantItem = { id: bigint; user: Address }

export function AdminParticipants({ client, account }: { client: SolanaClient; account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account })
  const [vault, setVault] = useState<Address | null>(null)
  const [participants, setParticipants] = useState<ParticipantItem[]>([])
  const [loading, setLoading] = useState(false)

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

  async function loadParticipants() {
    if (!signer?.address) return
    setLoading(true)
    try {
      const v = await deriveVaultPda(signer.address as Address)
      setVault(v)
      
      // Check if vault exists
      const maybeVault = await fetchMaybeVault(client.rpc, v)
      console.log('maybeVault', maybeVault)
      if (!maybeVault.exists) {
        // Vault doesn't exist, no participants to show
        setParticipants([])
        return
      }
      
      const currentLotteryId = maybeVault.data.lotteryId
      console.log('currentLotteryId', currentLotteryId)
      
      // Build filters: match Participant discriminator and vault field
      // Convert the 8-byte discriminator to a base58 string as required by memcmp
      const discB58 = getBase58Decoder().decode(getParticipantDiscriminatorBytes()) as unknown as Base58EncodedBytes
      const filters = [
        { memcmp: { offset: 0n, bytes: discB58, encoding: 'base58' as const } },
        { memcmp: { offset: 8n, bytes: v as unknown as Base58EncodedBytes, encoding: 'base58' as const } },
      ]
      const gpa = await client.rpc
        .getProgramAccounts(ON_CHAIN_LOTTERY_PROGRAM_ADDRESS, {
          commitment: 'confirmed',
          filters,
        })
        .send()

      const items: ParticipantItem[] = []
      for (const { pubkey } of gpa) {
        const maybe = await fetchMaybeParticipant(client.rpc, pubkey as Address)
        // Only include participants from the current lottery
        if (maybe.exists && maybe.data.lotteryId === currentLotteryId) {
          items.push({ id: maybe.data.id, user: maybe.data.user as Address })
        }
      }
      // Sort by id ascending
      items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      setParticipants(items)
    } catch {
      setParticipants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadParticipants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer?.address])

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-lg font-medium">Participants</div>
        <div className="text-sm text-muted-foreground">
          Listing all participants for vault {vault ?? '…'}.
        </div>
      </div>
      <div className="text-sm">
        {loading ? (
          <div>Loading…</div>
        ) : participants.length === 0 ? (
          <div className="text-muted-foreground">No participants found.</div>
        ) : (
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={String(p.id)} className="flex items-center justify-between rounded-md border p-2">
                <span className="font-mono">ID: {p.id.toString()}</span>
                <span className="truncate font-mono">{p.user}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}


