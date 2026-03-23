import { useState } from "react";
import {
  Shield, Eye, ArrowLeftRight, Link as LinkIcon, Brain, Coins, CreditCard, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Track {
  id: string;
  name: string;
  sponsor: string;
  prize: string;
  color: string;
  icon: React.ReactNode;
  metrics: { label: string; value: string }[];
  isActive: boolean;
  details?: string;
}

const TRACKS: Track[] = [
  {
    id: "protocol-labs",
    name: "Protocol Labs",
    sponsor: "Protocol Labs",
    prize: "$16K",
    color: "#0090FF",
    icon: <Shield className="h-5 w-5" />,
    metrics: [
      { label: "Agents", value: "8" },
      { label: "Logs", value: "247" },
      { label: "Latest Tx", value: "0x7c4...1e2a" },
    ],
    isActive: true,
    details: "ERC-8004 Agent Identity + Autonomous Loop integration.",
  },
  {
    id: "venice",
    name: "Venice",
    sponsor: "Venice",
    prize: "$11.5K",
    color: "#7C3AED",
    icon: <Eye className="h-5 w-5" />,
    metrics: [
      { label: "Inferences", value: "1.2K" },
      { label: "Models", value: "3" },
      { label: "Retention", value: "None" },
    ],
    isActive: true,
    details: "Private AI Cognition with zero data retention.",
  },
  {
    id: "uniswap",
    name: "Uniswap",
    sponsor: "Uniswap",
    prize: "$5K",
    color: "#FF007A",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    metrics: [
      { label: "Swaps", value: "156" },
      { label: "Volume", value: "$2.3M" },
      { label: "Pairs", value: "12" },
    ],
    isActive: true,
    details: "Token Swaps through Uniswap V4 hooks.",
  },
  {
    id: "metamask",
    name: "MetaMask",
    sponsor: "MetaMask",
    prize: "$5K",
    color: "#F6851B",
    icon: <LinkIcon className="h-5 w-5" />,
    metrics: [
      { label: "Chains", value: "24" },
      { label: "Authority", value: "$450K" },
      { label: "Delegated", value: "6" },
    ],
    isActive: true,
    details: "Delegation Framework for secure agent authority.",
  },
  {
    id: "bankr",
    name: "Bankr",
    sponsor: "Bankr",
    prize: "$5K",
    color: "#10B981",
    icon: <Brain className="h-5 w-5" />,
    metrics: [
      { label: "Requests", value: "8.9K" },
      { label: "Models", value: "7" },
      { label: "Tokens", value: "2.1M" },
    ],
    isActive: true,
    details: "LLM Gateway with intelligent routing.",
  },
  {
    id: "celo",
    name: "Celo",
    sponsor: "Celo",
    prize: "$5K",
    color: "#35D07F",
    icon: <Coins className="h-5 w-5" />,
    metrics: [
      { label: "Payments", value: "482" },
      { label: "Coins", value: "cUSD, cEUR" },
      { label: "Chains", value: "2" },
    ],
    isActive: true,
    details: "Multi-chain Stablecoin for rapid payments.",
  },
  {
    id: "locus-x402",
    name: "Locus/x402",
    sponsor: "Locus/x402",
    prize: "Open",
    color: "#3B82F6",
    icon: <CreditCard className="h-5 w-5" />,
    metrics: [
      { label: "Invoices", value: "94" },
      { label: "USDC", value: "$18.7K" },
      { label: "Success", value: "99.2%" },
    ],
    isActive: true,
    details: "Payment Infrastructure with x402 settlement.",
  },
];

export function TrackShowcase() {
  const [expanded, setExpanded] = useState<{ [k: string]: boolean }>({});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hackathon Tracks</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All {TRACKS.length} tracks integrated</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">All Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t) => (
          <Card
            key={t.id}
            className={cn(
              "cursor-pointer transition-all duration-300 hover:shadow-md border-l-4",
              expanded[t.id] ? "ring-2 ring-offset-2 dark:ring-offset-gray-950" : "",
            )}
            style={{ borderLeftColor: t.color } as React.CSSProperties}
            onClick={() => setExpanded((p) => ({ ...p, [t.id]: !p[t.id] }))}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${t.color}15` }}>
                    <div style={{ color: t.color }}>{t.icon}</div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.sponsor}</p>
                  </div>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              </div>
              <Badge variant="secondary" className="w-fit text-xs font-mono" style={{ backgroundColor: `${t.color}20`, color: t.color } as React.CSSProperties}>
                {t.prize}
              </Badge>
              <div className="space-y-1">
                {t.metrics.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900/40 rounded px-2 py-1">
                    <span className="text-gray-600 dark:text-gray-400">{m.label}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{m.value}</span>
                  </div>
                ))}
              </div>
              {expanded[t.id] && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{t.details}</p>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                <span>Expand</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform", expanded[t.id] && "rotate-90")} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
