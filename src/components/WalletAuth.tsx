import { ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { arbitrum } from "thirdweb/chains";
import { getDefaultToken } from "thirdweb/react";
import { useThirdwebClient } from "@/providers/ThirdwebProvider";

/** Wallet options: in-app (google, email, passkey) + external wallets */
const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "email", "passkey"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
];

/** USDC token on Arbitrum for balance display */
const usdcToken = getDefaultToken(arbitrum, "USDC");

/**
 * Full-screen sign-in page shown when no wallet is connected.
 */
export function WalletAuthScreen() {
  const client = useThirdwebClient();
  if (!client) return null;

  return (
    <div className="dark flex min-h-screen flex-col items-center justify-center bg-black text-zinc-100">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1118] text-2xl font-black text-white">
            A
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.12em] text-zinc-100">
            Agency
          </h1>
          <p className="max-w-sm text-center text-sm text-zinc-500">
            Connect your wallet to access the autonomous agent operating system.
          </p>
        </div>

        <ConnectButton
          client={client}
          wallets={wallets}
          chain={arbitrum}
          connectButton={{
            label: "Sign in",
          }}
          supportedTokens={
            usdcToken
              ? { [arbitrum.id]: [usdcToken] }
              : undefined
          }
          detailsButton={
            usdcToken
              ? {
                  displayBalanceToken: {
                    [arbitrum.id]: usdcToken.address,
                  },
                }
              : undefined
          }
          theme="dark"
        />
      </div>
    </div>
  );
}

/**
 * Inline ConnectButton for use in the app header after authentication.
 */
export function WalletHeaderButton() {
  const client = useThirdwebClient();
  if (!client) return null;

  return (
    <ConnectButton
      client={client}
      wallets={wallets}
      chain={arbitrum}
      connectButton={{
        label: "Connect Wallet",
      }}
      supportedTokens={
        usdcToken
          ? { [arbitrum.id]: [usdcToken] }
          : undefined
      }
      detailsButton={
        usdcToken
          ? {
              displayBalanceToken: {
                [arbitrum.id]: usdcToken.address,
              },
            }
          : undefined
      }
      theme="dark"
    />
  );
}
