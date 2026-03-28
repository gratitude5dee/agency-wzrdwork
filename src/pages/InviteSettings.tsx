import { Plus, Settings, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * InviteSettings page — manages user invitations and company settings.
 * TODO (M4.2.3): Integrate with compat-client for invitation and settings data.
 */
export function InviteSettingsPage() {
  // TODO: Load settings and pending invitations from compat-client

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-100">Invite & Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage user access and company configuration.</p>
      </div>

      {/* Invite Users Section */}
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
            <Mail className="h-4 w-4" />
            Invite Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="email" placeholder="user@example.com" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500" />
          <select className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">
            <option>Member</option>
            <option>Admin</option>
          </select>
          <Button className="w-full">Send Invitation</Button>
        </CardContent>
      </Card>

      {/* Company Settings Section */}
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
            <Settings className="h-4 w-4" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="text" placeholder="Company Name" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500" />
          <textarea placeholder="Description" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500" rows={2} />
          <Button className="w-full">Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
