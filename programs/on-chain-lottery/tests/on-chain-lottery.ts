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
import {
  Orao,
  networkStateAccountAddress,
  randomnessAccountAddress,
} from "@orao-network/solana-vrf";

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
  const vrf = new Orao(provider);
  const isDevnet = (provider.connection as any)?.rpcEndpoint?.includes("devnet");

  // Ensure tests run only on devnet
  before(function ensureDevnetOnly() {
    if (!isDevnet) {
      this.skip();
    }
  });


  let vaultPda: PublicKey;


  const vaultAuthority = Keypair.generate()
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  let lastForce: PublicKey | null = null;
  console.log("Vault Authority:", vaultAuthority.publicKey.toBase58())
  console.log("userA:", userA.publicKey.toBase58())
  console.log("userB:", userB.publicKey.toBase58())


  before("derive PDAs & fund users", async () => {
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), vaultAuthority.publicKey.toBuffer()],
      program.programId
    );

    console.log("vaultPda:", vaultPda.toBase58());

  await transferLamports(userA.publicKey,Math.floor(0.01*LAMPORTS_PER_SOL));
  await transferLamports(userB.publicKey,Math.floor(0.01*LAMPORTS_PER_SOL));
  await transferLamports(vaultAuthority.publicKey,Math.floor(0.05*LAMPORTS_PER_SOL));

  });
  
  // No local VRF init/emulation; devnet fulfillment handled by network



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


  it("commit and settle draw (ORAO VRF)", async () => {
    // Commit randomness request via ORAO VRF
    const force = Keypair.generate().publicKey;
    const forceBytes = [...force.toBuffer()];
    const randomAcc = randomnessAccountAddress(force.toBuffer());
    const config = networkStateAccountAddress();
    // Get proper treasury account from devnet network state (via Orao SDK)
    const networkState = await vrf.getNetworkState();
    const treasuryPk: PublicKey = networkState.config.treasury;

    const tx1 = await program.methods
      .commitDraw(forceBytes as unknown as number[])
      .accountsStrict({
        vaultAuthority: vaultAuthority.publicKey,
        vault: vaultPda,
        treasury: treasuryPk,
        config: config,
        random: randomAcc,
        vrf: vrf.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([vaultAuthority])
      .rpc();
    
    console.log("Your transaction signature", tx1)

    // Wait for fulfillment on devnet
    await vrf.waitFulfilled(force.toBuffer());

    // Settle draw using the fulfilled randomness account
    const tx2 = await program.methods
      .settleDraw()
      .accountsStrict({
        vaultAuthority: vaultAuthority.publicKey,
        vault: vaultPda,
        random: randomAcc,
      })
      .signers([vaultAuthority])
      .rpc();

    console.log("Your transaction signature", tx2)

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.drawn).to.eq(true);
    const winnerId = (vault.winnerId as BN).toNumber();
    console.log("winnerId", winnerId)
    expect(winnerId).to.be.gte(0).and.lt((vault.participantCount as BN).toNumber());
    lastForce = force;
  });


  it("should fail to draw another winner", async () => {
    try {
      const force = lastForce!;
      const randomAcc = randomnessAccountAddress(force.toBuffer());
      await program.methods
        .settleDraw()
        .accountsStrict({
          vaultAuthority: vaultAuthority.publicKey,
          vault: vaultPda,
          random: randomAcc,
        })
        .signers([vaultAuthority])
        .rpc();
      assert.fail("Expected AlreadyDrawn/AlreadyClaimed");
    } catch (error: any) {
      assert.isTrue(
        String(error.message).includes("AlreadyDrawn") ||
          String(error.message).includes("AlreadyClaimed"),
        "Expected error"
      );
    }
  });


  it("only the winner can claim, loser fails", async () => {
    // Read vault winner id after VRF settle
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.drawn).to.eq(true);
    const winnerId = (vault.winnerId as BN).toNumber();

    // Derive participant PDAs
    const [pdaA] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userA.publicKey.toBuffer()],
      program.programId
    );
    const [pdaB] = PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), vaultPda.toBuffer(), userB.publicKey.toBuffer()],
      program.programId
    );

    // Fetch participant accounts to map ids to users
    const partA = await program.account.participant.fetch(pdaA);
    const partB = await program.account.participant.fetch(pdaB);
    const idA = (partA.id as BN).toNumber();
    const idB = (partB.id as BN).toNumber();

    console.log("Participants detail:", {
      winnerId,
      participantA: {
        user: userA.publicKey.toBase58(),
        id: idA,
        pda: pdaA.toBase58(),
      },
      participantB: {
        user: userB.publicKey.toBase58(),
        id: idB,
        pda: pdaB.toBase58(),
      },
    });

    // Identify winner user and loser user with their participant PDAs
    const winner =
      winnerId === idA
        ? { user: userA, pda: pdaA }
        : { user: userB, pda: pdaB };
    const loser =
      winnerId === idA
        ? { user: userB, pda: pdaB }
        : { user: userA, pda: pdaA };

    console.log("Resolved winner selection:", {
      winnerPubkey: winner.user.publicKey.toBase58(),
      winnerPda: winner.pda.toBase58(),
      winnerMatchesIdA: winnerId === idA,
      winnerMatchesIdB: winnerId === idB,
    });

    // Loser claim should fail with InvalidWinner
    try {
      await program.methods
        .claimIfWinner()
        .accountsStrict({
          vaultAuthority: vaultAuthority.publicKey,
          user: loser.user.publicKey,
          vault: vaultPda,
          participant: loser.pda,
        })
        .signers([loser.user])
        .rpc();
      expect.fail("claimIfWinner should fail for non-winner");
    } catch (error: any) {
      assert.isTrue(
        String(error.message).includes("InvalidWinner"),
        "Expected InvalidWinner error"
      );
    }

    // Winner claim succeeds and vault is closed
    const beforeVaultLamports = await provider.connection.getBalance(vaultPda);
    const beforeWinnerLamports = await provider.connection.getBalance(
      winner.user.publicKey
    );

    await program.methods
      .claimIfWinner()
      .accountsStrict({
        vaultAuthority: vaultAuthority.publicKey,
        user: winner.user.publicKey,
        vault: vaultPda,
        participant: winner.pda,
      })
      .signers([winner.user])
      .rpc();

    const afterVaultInfo = await provider.connection.getAccountInfo(vaultPda);
    const afterWinnerLamports = await provider.connection.getBalance(
      winner.user.publicKey
    );

    expect(afterVaultInfo).to.eq(null); // closed by close = user
    expect(afterWinnerLamports).to.eq(beforeWinnerLamports + beforeVaultLamports);
  });




  // The above test already validates vault closure and payout to the winner.




});
