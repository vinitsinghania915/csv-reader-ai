"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Connection,
  Edge,
  Node
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Database, Link2 } from "lucide-react";

// Custom Node to display Table and its Columns
const TableNode = ({ data }: any) => {
  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-xl min-w-[200px] overflow-hidden">
      <div className="bg-indigo-600/20 px-4 py-2 border-b border-zinc-700/50 flex items-center gap-2">
         <Database size={14} className="text-indigo-400" />
         <span className="font-semibold text-sm text-zinc-200">{data.label}</span>
      </div>
      <div className="flex flex-col py-2">
        {data.columns.map((col: string, idx: number) => (
          <div key={col} className="relative flex items-center justify-between px-4 py-1.5 hover:bg-zinc-800/50 group">
             <Handle
               type="target"
               position={Position.Left}
               id={`target-${col}`}
               className="w-2 h-2 !bg-indigo-500 !border-2 !border-zinc-900 group-hover:scale-125 transition-transform"
             />
             <span className="text-xs text-zinc-400 select-none mr-4">{col}</span>
             <Handle
               type="source"
               position={Position.Right}
               id={`source-${col}`}
               className="w-2 h-2 !bg-emerald-500 !border-2 !border-zinc-900 group-hover:scale-125 transition-transform"
               style={{ right: -4 }}
             />
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = { tableNode: TableNode };

export default function SchemaBuilder({ workspaceId }: { workspaceId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Tables and Existing Relationships
  useEffect(() => {
    async function loadWorkspaceSchema() {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      try {
        // Fetch Tables
        const resTables = await fetch(`${apiUrl}/workspaces/${workspaceId}`, { credentials: "include" });
        const dataTables = await resTables.json();

        // Fetch existing Rel
        const resRels = await fetch(`${apiUrl}/workspaces/${workspaceId}/relationships`, { credentials: "include" });
        const dataRels = await resRels.json();

        // Build Nodes
        const newNodes = dataTables.tables.map((t: any, i: number) => ({
          id: t.name,
          type: 'tableNode',
          position: { x: 50 + (i * 300), y: 50 + (i * 100) },
          data: { label: t.name, columns: t.columns }
        }));
        
        // Build Edges
        const newEdges = dataRels.map((r: any) => ({
           id: `${r.id}`,
           source: r.table_a,
           target: r.table_b,
           sourceHandle: `source-${r.column_a}`,
           targetHandle: `target-${r.column_b}`,
           animated: true,
           style: { stroke: '#818cf8', strokeWidth: 2 }
        }));

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadWorkspaceSchema();
  }, [workspaceId, setNodes, setEdges]);

  // Handle drawing a new connection
  const onConnect = useCallback(async (params: Connection) => {
    // Save to DB immediately
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    
    // strip out "source-" and "target-" prefixes
    const colA = params.sourceHandle?.replace("source-", "");
    const colB = params.targetHandle?.replace("target-", "");

    try {
       const res = await fetch(`${apiUrl}/workspaces/${workspaceId}/relationships`, {
         method: "POST",
         credentials: "include",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            table_a: params.source,
            column_a: colA,
            table_b: params.target,
            column_b: colB,
            join_type: "inner"
         })
       });
       
       const savedData = await res.json();
       
       setEdges((eds) => addEdge({
          ...params,
          id: savedData.id,
          animated: true,
          style: { stroke: '#818cf8', strokeWidth: 2 }
       }, eds));

    } catch (e) {
       console.error("Failed to save relationship", e);
    }
  }, [setEdges, workspaceId]);

  if (isLoading) return <div className="h-full w-full flex items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent"></div></div>;

  return (
    <div className="h-full w-full bg-zinc-950 relative">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
         <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Link2 className="text-indigo-400" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">Relationship Builder</span>
         </h1>
         <p className="text-sm text-zinc-400">Drag connections between columns to join datasets.</p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap 
          nodeColor="#3f3f46" 
          maskColor="rgba(24, 24, 27, 0.7)"
          style={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
        />
        <Controls 
          className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden fill-zinc-300"
        />
        <Background color="#27272a" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
