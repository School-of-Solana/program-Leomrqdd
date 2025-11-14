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
import { expect, assert } from "chai";

// Naive randomness version: no Switchboard


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

  await transferLamports(userA.publicKey,Math.floor(0.01*LAMPORTS_PER_SOL));
  await transferLamports(userB.publicKey,Math.floor(0.01*LAMPORTS_PER_SOL));
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


  it("should fail because vault already initialized", async () => {
    // Add your test here.

    try {

      const tx = await program.methods
      .initVault(false)
      .accounts({
        vaultAuthority: vaultAuthority.publicKey,
      })
      .signers([vaultAuthority])
      .rpc();
      console.log("Your transaction signature", tx);

      // it should fail
      expect.fail("initVault should fail when vault PDA is already initialized");
    } catch (e: any) {
      // Extract error text and logs; assert it mentions "already in use"
      const msg: string = e?.message ?? "";
      const txLogs: string[] = Array.isArray(e?.transactionLogs) ? e.transactionLogs : [];
      let simLogs: string[] = [];
      if (typeof e?.getLogs === "function") {
        try { simLogs = (await e.getLogs()) ?? []; } catch {}
      }
      const haystack = [msg, ...txLogs, ...simLogs].join(" ");
      expect(haystack).to.match(/already in use/i);
    }

  });


  it("another Vault should be created", async () => {
    // Add your test here.

    const tx = await program.methods
    .initVault(false)
    .accounts({
      vaultAuthority: userA.publicKey,
    })
    .signers([userA])
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


  it("userA and user B should be able to deposit again", async () => {
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



  it("userA should not be able to deposit again", async () => {

    const amount = new BN(0.001 * LAMPORTS_PER_SOL);

    const [pa] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userA.publicKey.toBuffer()],
      program.programId
    );

    try {
      const tx1 = await program.methods
      .deposit(amount)
      .accounts({
        user: userA.publicKey,
        vault: vaultPda,
      })
      .signers([userA])
      .rpc();

      console.log("Your transaction signature", tx1);
      expect.fail("deposit should fail when vault is locked");

    }
    catch (e: any){

      const logs: string[] = Array.isArray(e?.errorLogs) ? e.errorLogs : [];
      const haystack = logs.join(" ");
      expect(haystack).to.match(/Vault is locked/i);
    }


  });


  it("commit and settle draw (naive)", async () => {
    // Optional commit step (no-op in naive mode), requires locked vault
    await program.methods
      .commitDraw()
      .accounts({ vault: vaultPda })
      .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
      .signers([vaultAuthority])
      .rpc();

    // Settle by providing a winner_id explicitly (e.g., 0 for the first participant)
    const chosenWinner = new BN(0);
    await program.methods 
      .settleDraw(chosenWinner)
      .accounts({ vault: vaultPda })
      .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
      .signers([vaultAuthority])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.drawn).to.eq(true);
    const winnerId = (vault.winnerId as BN).toNumber();
    expect(winnerId).to.be.gte(0).and.lt((vault.participantCount as BN).toNumber());
  });


  it("should fail to draw another winner", async () => {

    try {
          // Settle by providing a winner_id explicitly (e.g., 0 for the first participant)
    const chosenWinner = new BN(0);
    await program.methods 
      .settleDraw(chosenWinner)
      .accounts({ vault: vaultPda })
      .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
      .signers([vaultAuthority])
      .rpc();

    }

    catch(error) {
      assert.isTrue(error.message.includes("AlreadyDrawn") || error.message.includes("AlreadyClaimed"), "Expected error")
    }

  });


  it("userB should fail to claim (Invalid winner)", async () => {
    // userB essaie de claim alors que winnerId a été fixé (souvent 0 => userA)
    try {
      await program.methods
        .claimIfWinner()
        .accounts({ user: userB.publicKey })
        .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
        .signers([userB])
        .rpc();
      expect.fail("claimIfWinner should fail for non-winner userB");
    } catch (error) {
      assert.isTrue(error.message.includes("InvalidWinner") || error.message.includes("InvalidWinner"), "Expected error")
    }
  });




  it("claim if the winner is the good one", async () => {

    const beforeVault = await provider.connection.getBalance(vaultPda)
    const beforeA = await provider.connection.getBalance(userA.publicKey)


    const vault = await program.account.vault.fetch(vaultPda);
    const winnerId = (vault.winnerId as BN).toNumber();


    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userA.publicKey.toBuffer()],
      program.programId
      );
      
      await program.methods
        .claimIfWinner()
        .accounts({ user: userA.publicKey })
        .accountsPartial({ vaultAuthority: vaultAuthority.publicKey })
        .signers([userA])
        .rpc();
    

    const afterVault = await provider.connection.getBalance(vaultPda);
    const afterA = await provider.connection.getBalance(userA.publicKey)

    expect(afterVault).to.eq(0);
    expect(afterA).to.eq(beforeA + beforeVault);

  });


  it("vault account should be closed after winner claim", async () => {
    const info = await provider.connection.getAccountInfo(vaultPda);
    expect(info).to.eq(null);
  });




});
