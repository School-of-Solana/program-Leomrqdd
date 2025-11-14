import { Card } from '@/components/ui/card'
import { useSolana } from '@/components/solana/use-solana'
import { LotteryDeposit } from './lottery-deposit'
import { LotteryClaim } from './lottery-claim'

export default function LotteryFeature() {
  const { account, connected, client } = useSolana()
  return (
    <div className="container mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Lottery</h1>
      {!connected || !account ? (
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Connect a wallet to initialize the vault.</div>
        </Card>
      ) : (
        <>
          <LotteryDeposit client={client} account={account} />
          <LotteryClaim client={client} account={account} />
        </>
      )}
    </div>
  )
}
