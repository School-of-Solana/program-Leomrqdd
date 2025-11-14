import { Card } from '@/components/ui/card'
import { useSolana } from '@/components/solana/use-solana'
import { LotteryInitVault } from '@/features/admin/lottery-init-vault'
import { AdminToggleLock } from './admin-toggle-lock'
import { AdminSettleDraw } from './admin-settle-draw'
import { AdminParticipants } from './admin-participants'

export default function AdminFeature() {
  const { account, connected, client } = useSolana()
  return (
    <div className="container mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {!connected || !account ? (
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Connect the vault authority wallet to manage the vault.</div>
        </Card>
      ) : (
        <>
          <LotteryInitVault client={client} account={account} />
          <AdminToggleLock client={client} account={account} />
          <AdminSettleDraw client={client} account={account} />
          <AdminParticipants client={client} account={account} />
        </>
      )}
    </div>
  )
}


