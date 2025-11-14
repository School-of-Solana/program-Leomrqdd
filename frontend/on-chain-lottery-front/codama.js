import { createCodamaConfig } from "gill";

// Generate a TypeScript client from the Anchor IDL and output it under src/clients/generated
export default createCodamaConfig({
  // Relative to this config file. Ensure you've run `anchor build` so the IDL exists.
  idl: "../../programs/on-chain-lottery/target/idl/on_chain_lottery.json",
  // Generated client destination inside the frontend project
  clientJs: "src/clients/generated",
});


