// import React from "react";
// import ToggleArrow from "./ToggleArrow";

// // type ArchivedSkill = {
// //   id: string;
// //   name: string;
// //   difficulty?: string;
// //   completedAt: number;
// //   originalSkillId?: string;
// //   subskills?: { id: string; name: string; difficulty?: string; progress?: number; tags?: { id: string; name: string; color?: string }[] }[];

// //   createdAt?: number;
// // };

// const fmt = (ms: number) => new Date(ms).toLocaleString();

// const MasteredSkillsArchive: React.FC<{ archived?: ArchivedSkill[]; onDelete?: (a: ArchivedSkill) => void; onRestore?: (a: ArchivedSkill) => void; onRevive?: (a: ArchivedSkill) => void }> = ({ archived = [], onDelete, onRestore, onRevive }) => {
//   const sorted = (archived || []).slice().sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
//   const count = sorted.length;

//   const [sortOption, setSortOption] = React.useState<'completed' | 'created' | 'abc'>('completed');

//   const [open, setOpen] = React.useState(false);
//   const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
//   const [expandedSubskills, setExpandedSubskills] = React.useState<Record<string, boolean>>({});
//   const [lastDeleted, setLastDeleted] = React.useState<ArchivedSkill | null>(null);
//   const [undoVisible, setUndoVisible] = React.useState(false);
//   const undoTimer = React.useRef<number | null>(null);

//   const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));
//   const toggleSub = (id: string) => setExpandedSubskills(e => ({ ...e, [id]: !e[id] }));

//   const fmtDuration = (ms: number) => {
//     if (!ms || ms <= 0) return "0m";
//     const sec = Math.floor(ms / 1000);
//     const days = Math.floor(sec / 86400);
//     const hours = Math.floor((sec % 86400) / 3600);
//     const minutes = Math.floor((sec % 3600) / 60);
//     const parts = [] as string[];
//     if (days) parts.push(`${days}d`);
//     if (hours) parts.push(`${hours}h`);
//     if (minutes || parts.length === 0) parts.push(`${minutes}m`);
//     return parts.join(" ");
//   };

//   const doDelete = (item: ArchivedSkill) => {
//     try {
//       onDelete && onDelete(item);
//     } catch (err) {
//       console.error('Error deleting archived item', err);
//     }
//     setLastDeleted(item);
//     setUndoVisible(true);
//     if (undoTimer.current) window.clearTimeout(undoTimer.current);
//     undoTimer.current = window.setTimeout(() => {
//       setLastDeleted(null);
//       setUndoVisible(false);
//       undoTimer.current = null;
//     }, 8000);
//   };

//   const doUndo = () => {
//     if (!lastDeleted) return;
//     try {
//       onRestore && onRestore(lastDeleted);
//     } catch (err) {
//       console.error('Error restoring archived item', err);
//     }
//     if (undoTimer.current) {
//       window.clearTimeout(undoTimer.current);
//       undoTimer.current = null;
//     }
//     setLastDeleted(null);
//     setUndoVisible(false);
//   };

//   return (
//     <div className="w-full max-w-md mx-auto my-4">
//       <div className="flex items-center justify-between bg-white border rounded px-3 py-2 shadow-sm">
//         <div className="font-semibold">Skill Archive ({count})</div>
//         <button
//           onClick={() => setOpen(p => !p)}
//           aria-label={open ? 'Collapse archive' : `Expand archive (${count})`}
//           className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
//         >
//           <ToggleArrow open={open} size={18} />
//         </button>
//       </div>

//       {open && (
//         <div className="mt-3 bg-white border rounded p-3">
//           <div className="mb-3 flex items-center gap-3">
//             <div className="text-sm text-gray-600">Sort:</div>
//             <select
//               value={sortOption}
//               onChange={(e) => setSortOption(e.target.value as any)}
//               className="text-sm bg-white border rounded px-2 py-1"
//               aria-label="Sort archived skills"
//             >
//               <option value="abc">ABC</option>
//               <option value="created">Created</option>
//               <option value="completed">Completed</option>
//             </select>
//           </div>
//           {/* compute sorted list according to selection */}
//           {(() => {
//             const list = (archived || []).slice();
//             if (sortOption === 'abc') {
//               list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
//             } else if (sortOption === 'created') {
//               list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
//             } else {
//               list.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
//             }
//             return (
//               <>
//                 {list.length === 0 && <div className="text-sm text-gray-500">No archived skills</div>}
//                 {list.map(s => (
//                   <div key={s.id} className="py-2 border-b last:border-b-0">
//                     <div className="w-full flex items-start justify-between">
//                       <button onClick={() => toggle(s.id)} className="text-left flex-1 text-sm font-medium text-left">
//                         {s.name}
//                       </button>
//                       <div className="flex items-center gap-2">
//                         <div className="text-xs text-gray-500">{fmt(s.completedAt)}</div>
//                         <div className="flex items-center gap-2">
//                           <button onClick={() => onRevive && onRevive(s)} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Revive</button>
//                           <button onClick={() => doDelete(s)} className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">Delete</button>
//                         </div>
//                       </div>
//                     </div>
//                     {expanded[s.id] && (
//                       <div className="mt-2 pl-2 text-sm text-gray-700">
//                         <div className="mb-2">Difficulty: <span className="font-medium">{s.difficulty ?? 'unknown'}</span></div>
//                         <div className="mb-2">Created at: <span className="text-xs text-gray-600">{s.createdAt ? fmt(s.createdAt) : 'unknown'}</span></div>
//                         <div className="mb-2">Time to complete: <span className="text-xs text-gray-600">{s.createdAt ? fmtDuration(s.completedAt - s.createdAt) : 'unknown'}</span></div>
//                         <div className="text-xs text-gray-600 mb-1">Subskills:</div>
//                         {(s.subskills && s.subskills.length > 0) ? (
//                           <div className="ml-2">
//                             {(s.subskills || []).map(ss => (
//                               <div key={ss.id} className="mb-2">
//                                 <button onClick={() => toggleSub(ss.id)} className="text-left w-full flex items-center justify-between">
//                                   <div className="text-sm">{ss.name} <span className="text-xs text-gray-500">({ss.difficulty ?? 'simple'})</span></div>
//                                   <div className="text-xs text-gray-500">{expandedSubskills[ss.id] ? '▾' : '▸'}</div>
//                                 </button>
//                                 {expandedSubskills[ss.id] && (
//                                   <div className="mt-1 ml-4 text-sm text-gray-700">
//                                     {(ss.tags && ss.tags.length > 0) ? (
//                                       <ul className="list-disc ml-4">
//                                         {ss.tags.map((t: any) => (
//                                           <li key={t.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</li>
//                                         ))}
//                                       </ul>
//                                     ) : (
//                                       <div className="text-xs text-gray-500">No tags</div>
//                                     )}
//                                   </div>
//                                 )}
//                               </div>
//                             ))}
//                           </div>
//                         ) : (
//                           <div className="text-xs text-gray-500">No subskills</div>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 ))}
//               </>
//             );
//           })()}

//         </div>
//       )}
//       {/* Undo snackbar */}
//       {undoVisible && lastDeleted && (
//         <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded shadow-lg flex items-center gap-4">
//           <div>Deleted "{lastDeleted.name}"</div>
//           <button onClick={doUndo} className="underline">Undo</button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MasteredSkillsArchive;
