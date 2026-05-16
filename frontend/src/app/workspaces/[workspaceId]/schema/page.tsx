import AppShell from "@/components/layout/AppShell";
import SchemaBuilder from "@/components/relationships/SchemaBuilder";

export default async function SchemaPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  
  return (
    <AppShell workspaceId={workspaceId}>
      <div className="h-full w-full">
        <SchemaBuilder workspaceId={workspaceId} />
      </div>
    </AppShell>
  );
}
