import React, { useState } from 'react'
import { useAgencyStore, type Task, type TaskStatus } from '../store/agencyStore'
import { getActiveAgentSet } from '../store/agencyStore'
import { ChevronDown, ChevronRight, MessageSquareWarning } from 'lucide-react'
import { useStore } from '../store/useStore'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'scheduled',   label: 'Scheduled'   },
  { status: 'on_hold',     label: 'On Hold'      },
  { status: 'in_progress', label: 'In Progress'  },
  { status: 'done',        label: 'Done'         },
]

interface KanbanPanelProps {
  height?: number;
}

function renderAgentTag(agentIndex: number) {
  if (agentIndex === 0) { // Client / You
     return (
      <span key={agentIndex} className="flex items-center gap-1 text-[10px] text-[#7EACEA] font-bold">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#7EACEA]"
        />
        You
      </span>
    )
  }
  const agent = getActiveAgentSet().agents.find(a => a.index === agentIndex)
  if (!agent) return null
  return (
    <span key={agentIndex} className="flex items-center gap-1 text-[10px] text-zinc-400">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: agent.color }}
      />
      {agent.role}
    </span>
  )
}

function TaskCard({ task }: { task: Task; key?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { setSelectedNpc } = useStore()

  // For visual representation, if on_hold, we "virtualize" the client being assigned
  const effectiveAgentIds = task.status === 'on_hold'
    ? [...new Set([0, ...task.assignedAgentIds])]
    : task.assignedAgentIds

  const handleSelectAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Select the first assigned NPC (not client)
    const agentId = task.assignedAgentIds.find(id => id !== 0);
    if (agentId !== undefined) {
      setSelectedNpc(agentId);
    }
  };

  return (
    <div key={task.id} className="group relative space-y-2 rounded-lg border border-white/10 bg-[#0d1118] p-3 shadow-sm">
      <div
        className="flex items-start justify-between gap-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="flex-1 text-xs font-bold leading-snug text-zinc-100">
          {task.title || 'Untitled Task'}
        </h3>
        <div className="flex items-center gap-1">
          {task.status === 'on_hold' && (
            <button
              onClick={handleSelectAgent}
              className="p-1 text-white bg-orange-500 hover:bg-orange-600 rounded mr-1"
              title="Select agent waiting for approval"
            >
              <MessageSquareWarning size={14} />
            </button>
          )}
          <button className="text-zinc-500 transition-colors group-hover:text-zinc-200">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <p className="animate-in slide-in-from-top-1 rounded border border-white/10 bg-[#111724] p-2 text-[11px] leading-relaxed text-zinc-300 duration-200 fade-in">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1">
        {effectiveAgentIds.map(renderAgentTag)}
      </div>
      {task.status === 'in_progress' && (
        <span className="inline-block rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-200">
          working
        </span>
      )}
    </div>
  )
}

export function KanbanPanel({ height = 320 }: KanbanPanelProps) {
  const { tasks } = useAgencyStore()

  return (
    <div
      className="relative flex w-full shrink-0 flex-col border-t border-white/10 bg-[#070a11] pointer-events-auto"
      style={{ height }}
    >
      {/* Columns Scroll Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#05070c]">
        <div className="flex h-full min-w-max px-5 py-4 gap-4">
          {COLUMNS.map(({ status, label }) => {
            const colTasks = tasks.filter((t) => t.status === status)
            return (
              <div key={status} className="w-60 flex flex-col gap-3">
                <div className="flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none">
                      {label}
                    </span>
                    <span className="min-w-4.5 rounded-md border border-white/10 bg-[#10151e] px-1.5 py-0.5 text-center text-[9px] font-bold text-zinc-400">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#0b0f16] p-4 select-none">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
