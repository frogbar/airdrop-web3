const {
    Connection,
    Keypair,
    PublicKey,
    clusterApiUrl,
  } = require('@solana/web3.js');
  const {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
  } = require('@solana/spl-token');
require("dotenv").config();
  
  // Replace with your private key string
  const privateKeyString = process.env.private_key || ""; // Example Base58 key
  
  // Import bs58 for decoding Base58 string
  const bs58 = require('bs58');
  
  // Decode the private key string
  const privateKey = bs58.decode(privateKeyString);
  
  // Load the wallet using the private key
  const payer = Keypair.fromSecretKey(Uint8Array.from(privateKey));
  
  // Connect to Solana devnet
  console.log("account address: ", payer.publicKey.toString())
  const connection = new Connection("https://multi-magical-frost.solana-mainnet.quiknode.pro/3185adc05cf6a6a71925659164c2328ffe800551", 'confirmed');
  
  (async () => {
    // 1. Create a new mint
    const mint = await createMint(
      connection,         // Solana connection
      payer,              // Payer of transaction fees
      payer.publicKey,    // Authority that can mint new tokens
      null,               // Freeze authority (set to null if not needed)
      6                   // Number of decimal places for the token
    );
    console.log('Created new token with mint address:', mint.toBase58());
  
    // 2. Get or create an associated token account for the wallet
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,         // Solana connection
      payer,              // Payer of transaction fees
      mint,               // Mint address
      payer.publicKey     // Owner of the token account
    );
    console.log('Token account created at:', tokenAccount.address.toBase58());
  
    // 3. Mint tokens to the token account
    // 1M coins
    const amount = 500_000_000_000_000_000; // Amount of tokens (in smallest units, considering decimals)
    await mintTo(
      connection,         // Solana connection
      payer,              // Payer of transaction fees
      mint,               // Mint address
      tokenAccount.address, // Token account address
      payer.publicKey,    // Authority to mint tokens
      amount              // Amount to mint
    );
    console.log(`Minted ${amount} tokens to ${tokenAccount.address.toBase58()}`);
  })();
  