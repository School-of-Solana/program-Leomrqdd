import * as anchor from "@coral-xyz/anchor";
import { Program, BN} from "@coral-xyz/anchor";
import { OnChainLottery } from "../target/types/on_chain_lottery";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import { expect } from "chai";

import * as sb from "@switchboard-xyz/on-demand";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));


describe("on-chain-lottery", () => {

  // transfer small SOL from provider wallet (vaultAuthority) to a recipient
  async function transferLamports(
    recipient: PublicKey,
    lamports: number
    ) {
      const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: recipient,
          lamports,
        })
      );
    await provider.sendAndConfirm(tx); // provider.wallet signe
    }

  // Configure the client to use the devnet cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  

  const program = anchor.workspace.onChainLottery as Program<OnChainLottery>;
  const funded_wallet = provider.wallet.publicKey;


  let vaultPda: PublicKey;


  const vaultAuthority = Keypair.generate()
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  console.log("Vault Authority:", vaultAuthority.publicKey)
  console.log("userA:", userA.publicKey)
  console.log("userB:", userB.publicKey)


  before("derive PDAs & fund users", async () => {
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), vaultAuthority.publicKey.toBuffer()],
      program.programId
    );

    console.log("vaultPda:", vaultPda);

  await transferLamports(userA.publicKey,Math.floor(0.005*LAMPORTS_PER_SOL));
  await transferLamports(userB.publicKey,Math.floor(0.005*LAMPORTS_PER_SOL));
  await transferLamports(vaultAuthority.publicKey,Math.floor(0.005*LAMPORTS_PER_SOL));

  });
  



  it("initialize vault (unlocked)", async () => {
    // Add your test here.
    const tx = await program.methods
    .initVault(false)
    .accounts({
      vaultAuthority: vaultAuthority.publicKey,
    })
    .signers([vaultAuthority])
    .rpc();
    console.log("Your transaction signature", tx);

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.vaultAuthority.toBase58()).to.eq(vaultAuthority.publicKey.toBase58());
    expect(vault.locked).to.eq(false);
    expect((vault.participantCount as BN).toNumber()).to.eq(0);

  });



  it("userA and userB deposit (create Participant PDAs once)", async () => {
    const before = await provider.connection.getBalance(vaultPda)
    const amount = new BN(0.001 * LAMPORTS_PER_SOL);

    const [pa] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userA.publicKey.toBuffer()],
      program.programId
    );
    const tx1 = await program.methods
      .deposit(amount)
      .accounts({
        user: userA.publicKey,
        vault: vaultPda,
      })
      .signers([userA])
      .rpc();

    console.log("Your transaction signature", tx1);

    const [pb] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userB.publicKey.toBuffer()],
      program.programId
    );

    const tx2 = await program.methods
      .deposit(amount)
      .accounts({
        user: userB.publicKey,
        vault: vaultPda,
      })
      .signers([userB])
      .rpc();

    console.log("Your transaction signature", tx2);

    const after = await provider.connection.getBalance(vaultPda)
    const expectedIncrease = 2 * new BN(0.001 * LAMPORTS_PER_SOL).toNumber();
    expect(after - before).to.eq(expectedIncrease);

    const vault = await program.account.vault.fetch(vaultPda);
    expect((vault.participantCount as BN).toNumber()).to.eq(2);
  });



  it("toggle lock", async() => {
    const tx = await program.methods
    .toggleLock()
    .accounts({ vault: vaultPda })
    // provide the signer account explicitly despite typed inference
    .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
    .signers([vaultAuthority])
    .rpc();
  console.log("Your transaction signature", tx);

  })



  it("commit → reveal → settle_draw using Switchboard", async () => {
    // Build an Anchor Program for Switchboard On-Demand
    const sbProgramId = sb.ON_DEMAND_DEVNET_PID; // Devnet PID from SDK
    const sbProgram = await anchor.Program.at(sbProgramId, provider); 

    // 1) Create a randomness account
    const rngKp = Keypair.generate();
    const [randomness, createIx] = await sb.Randomness.create(
      sbProgram,
      rngKp,
      sb.ON_DEMAND_DEVNET_QUEUE
    );
    
    await provider.sendAndConfirm(new Transaction().add(createIx), [rngKp]);


    // 2) Commit to a future slot
    const commitIx = await randomness.commitIx(sb.ON_DEMAND_DEVNET_QUEUE);
  
    // Your program stores randomness account (and optionally commit_slot)
    await program.methods
      .commitDraw()
      .accounts({
        randomnessAccountData: randomness.pubkey,
      })
      .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
      .preInstructions([commitIx])
      .signers([vaultAuthority])
      .rpc();

    console.log('Ok commitDraw')
    
    // 3) Wait >=1 slot, then reveal randomness
    await sleep(1500);
    const revealIx = await randomness.revealIx();
    console.log('Ok reveal')

    // 4) Settle: program reads randomness, computes winner_id
    await program.methods
      .settleDraw()
      .accounts({
        randomnessAccountData: randomness.pubkey,
      })
      .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
      .preInstructions([revealIx])
      .signers([vaultAuthority])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.drawn).to.eq(true);
    const winnerId = (vault.winnerId as BN).toNumber();
    expect(winnerId).to.be.gte(0).and.lt((vault.participantCount as BN).toNumber());
  
    });

});
