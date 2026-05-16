import AppShell from "@/components/layout/AppShell";
import ChatContainer from "@/components/chat/ChatContainer";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  
  return (
    <AppShell workspaceId={workspaceId}>
      <div className="h-full w-full">
        <ChatContainer workspaceId={workspaceId} />
      </div>
    </AppShell>
  );
}
