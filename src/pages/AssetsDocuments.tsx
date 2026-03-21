import { Plus, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * AssetsDocuments page — manages shared files, documents, and assets for the agency.
 * TODO (M4.2.3): Integrate with compat-client for asset/document storage.
 */
export function AssetsDocumentsPage() {
  // TODO: Load documents from compat-client
  const documents: Array<{ id: string; name: string; type: string; uploadedAt: string }> = [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Assets & Documents</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage shared files and resources for your agency.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* File Browser */}
      {documents.length === 0 ? (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-zinc-600" />
            <p className="text-center text-zinc-400">No documents yet.</p>
            <Button className="mt-4" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-black/20">
            <Folder className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-300">Documents</span>
          </div>
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">
              <FileText className="h-4 w-4 text-zinc-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{doc.name}</p>
                <p className="text-xs text-zinc-500">{doc.uploadedAt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
