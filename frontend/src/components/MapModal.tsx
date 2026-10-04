import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { isAdmin } from '../utils/adminConfig';
import { getItemsForCharacter, addItemToCharacter, updateItemForCharacter, deleteItemFromCharacter } from '../services/characterService';
import { QrCodeGenerator } from './QrCodeGenerator';


type Props = {
    onClose: () => void;
    userId?: string | null;
    characterId?: string | null;
};

type MapNode = {
    id: string;
    title: string;
    color?: string;
    children?: MapNode[];
};

// Read-only collapsible list view used in left panel when expanding a map
function CategoryEditor({ node, onAddChild, onUpdate, onRemove, showControls = true }: { node: MapNode; onAddChild?: (parentId: string, title?: string) => void; onUpdate?: (id: string, title: string) => void; onRemove?: (id: string) => void; showControls?: boolean }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(node.title);
    useEffect(() => setValue(node.title), [node.title]);
    return (
        <div className="p-2 border rounded bg-white">
            <div className="flex items-center gap-2">
                {editing ? (
                    <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => { setEditing(false); onUpdate && onUpdate(node.id, value.trim() || node.title); }} className="flex-1 border rounded px-2 py-1 text-sm" />
                ) : (
                    <div className="flex-1 text-sm font-medium">{node.title}</div>
                )}
                {showControls && (
                    <div className="flex items-center gap-1">
                        <button onClick={() => onAddChild && onAddChild(node.id)} className="px-2 py-1 bg-gray-100 rounded text-xs">+Child</button>
                        <button onClick={() => setEditing((s) => !s)} className="px-2 py-1 bg-gray-100 rounded text-xs">Edit</button>
                        <button onClick={() => onRemove && onRemove(node.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">Del</button>
                    </div>
                )}
            </div>
            {node.children && node.children.length > 0 && (
                <div className="mt-2 ml-4 flex flex-col gap-1">
                    {node.children.map((c) => (
                        <CategoryEditor key={c.id} node={c} onAddChild={onAddChild} onUpdate={onUpdate} onRemove={onRemove} showControls={showControls} />
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryListView({ node, mapId, onAddChild, onUpdateNode, onRemoveNode, editNodeId }: { node: MapNode; mapId?: string; onAddChild?: (mapId: string, parentId: string) => void; onUpdateNode?: (mapId: string, nodeId: string, patch: string | { title?: string; color?: string }) => void; onRemoveNode?: (mapId: string, nodeId: string) => void; editNodeId?: string | null }) {
    const [open, setOpen] = useState<boolean>(false);
    const [editing, setEditing] = useState<boolean>(false);
    const [value, setValue] = useState<string>(node.title);
    const inputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => setValue(node.title), [node.title]);

    // helper: determine if this node's subtree contains the target id
    const containsNode = (n: MapNode, targetId: string | null): boolean => {
        if (!targetId) return false;
        if (n.id === targetId) return true;
        if (!n.children) return false;
        return n.children.some((c) => containsNode(c, targetId));
    };

    // if editNodeId points to a node inside this subtree, ensure it's expanded so the target becomes visible
    useEffect(() => {
        if (editNodeId && containsNode(node, editNodeId)) {
            setOpen(true);
        }
    }, [editNodeId, node]);

    // trigger editing state when this exact node is the edit target
    useEffect(() => {
        if (editNodeId && editNodeId === node.id) setEditing(true);
    }, [editNodeId, node.id]);

    // autofocus the input when entering editing mode
    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            // move caret to end
            const val = inputRef.current.value;
            inputRef.current.setSelectionRange(val.length, val.length);
        }
    }, [editing]);

    return (
        <div className="mb-1">
            <div className="flex items-center gap-2">
                <button onClick={() => setOpen((s) => !s)} className="px-2 py-1 bg-gray-100 rounded text-xs">{open ? '▾' : '▸'}</button>
                <div className="text-sm flex-1">
                    {editing ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                            <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={async (e) => { e.stopPropagation(); if (onUpdateNode && mapId) await onUpdateNode(mapId, node.id, value); setEditing(false); }} className="px-2 py-1 bg-emerald-500 text-white rounded text-xs w-full sm:w-auto">Save</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditing(false); setValue(node.title); }} className="px-2 py-1 bg-gray-200 rounded text-xs w-full sm:w-auto">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>{node.title}</div>
                            <div className="flex items-center gap-1">
                                <input onClick={(e) => e.stopPropagation()} value={node.color || '#ffffff'} onChange={(e) => { e.stopPropagation(); if (onUpdateNode && mapId) onUpdateNode(mapId, node.id, { color: e.target.value }); }} type="color" className="w-6 h-6 p-0 border rounded" />
                                <button onClick={(e) => { e.stopPropagation(); if (onAddChild && mapId) onAddChild(mapId, node.id); }} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">+</button>
                                <button onClick={(e) => { e.stopPropagation(); if (onRemoveNode && mapId) onRemoveNode(mapId, node.id); }} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">Del</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {open && node.children && node.children.length > 0 && (
                <div className="mt-1 ml-4">
                    {node.children.map(c => <CategoryListView key={c.id} node={c} mapId={mapId} onAddChild={onAddChild} onUpdateNode={onUpdateNode} onRemoveNode={onRemoveNode} editNodeId={editNodeId} />)}
                </div>
            )}
        </div>
    );
}

// ─── Spreadsheet types ───────────────────────────────────────────────────────
type SpreadsheetCol = { id: string; header: string; type: 'text' | 'checkbox' };
type SpreadsheetRow = { id: string; cells: Record<string, string | boolean> };
interface SpreadsheetDoc { id: string; title: string; createdAt: number; columns: SpreadsheetCol[]; rows: SpreadsheetRow[]; frozenCols?: number; frozenRows?: number }

/** Returns true if any text cell in the row contains exactly "total" (case-insensitive). */
function isTotalRow(row: SpreadsheetRow): boolean {
    return Object.values(row.cells).some(
        v => typeof v === 'string' && v.trim().toLowerCase() === 'total'
    );
}

/** Sum all numeric cell values in `colId` for non-total rows strictly above `stopIndex`. */
function computeColTotal(rows: SpreadsheetRow[], colId: string, stopIndex: number): { sum: number; hasNumbers: boolean } {
    let sum = 0;
    let hasNumbers = false;
    for (let i = 0; i < stopIndex; i++) {
        if (isTotalRow(rows[i])) continue;
        const val = rows[i].cells[colId];
        if (typeof val === 'string') {
            const num = parseFloat(val);
            if (!isNaN(num)) { sum += num; hasNumbers = true; }
        }
    }
    return { sum, hasNumbers };
}

// ─── SpreadsheetPanel ────────────────────────────────────────────────────────
const SpreadsheetPanel: React.FC<{ userId?: string | null; characterId?: string | null }> = ({ userId, characterId }) => {
    const [sheets, setSheets] = useState<SpreadsheetDoc[]>([]);
    const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);
    const [columns, setColumns] = useState<SpreadsheetCol[]>([]);
    const [rows, setRows] = useState<SpreadsheetRow[]>([]);
    const [sheetTitle, setSheetTitle] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingHeader, setEditingHeader] = useState<string | null>(null);
    const [editingHeaderDraft, setEditingHeaderDraft] = useState('');
    const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
    const [sheetListCollapsed, setSheetListCollapsed] = useState(false);
    const [sheetViewCollapsed, setSheetViewCollapsed] = useState(false);
    const [openColMenu, setOpenColMenu] = useState<string | null>(null);
    const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
    const [openSheetMenu, setOpenSheetMenu] = useState<string | null>(null);
    const [frozenCols, setFrozenCols] = useState(0);
    const [frozenRows, setFrozenRows] = useState(0);

    // Refs + measured offsets used to position sticky ("frozen") header/column/row cells.
    const rowNumHeaderRef = useRef<HTMLTableCellElement | null>(null);
    const colHeaderRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
    const dataRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const [colLeftOffsets, setColLeftOffsets] = useState<Record<string, number>>({});
    const [rowTopOffsets, setRowTopOffsets] = useState<Record<string, number>>({});

    // Close any open context menu when clicking outside
    useEffect(() => {
        const handler = () => { setOpenColMenu(null); setOpenRowMenu(null); setOpenSheetMenu(null); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Measure header/column/row extents so frozen cells can be pinned via `position: sticky`.
    useLayoutEffect(() => {
        if (sheetViewCollapsed || (frozenCols === 0 && frozenRows === 0)) return;
        const hh = rowNumHeaderRef.current?.getBoundingClientRect().height || 0;
        const rw = rowNumHeaderRef.current?.getBoundingClientRect().width || 0;

        const nextColOffsets: Record<string, number> = {};
        let runningLeft = rw;
        for (const col of columns) {
            nextColOffsets[col.id] = runningLeft;
            runningLeft += colHeaderRefs.current[col.id]?.getBoundingClientRect().width || 0;
        }
        setColLeftOffsets(nextColOffsets);

        const nextRowOffsets: Record<string, number> = {};
        let runningTop = hh;
        for (const row of rows) {
            nextRowOffsets[row.id] = runningTop;
            runningTop += dataRowRefs.current[row.id]?.getBoundingClientRect().height || 0;
        }
        setRowTopOffsets(nextRowOffsets);
    }, [columns, rows, frozenCols, frozenRows, sheetViewCollapsed, currentSheetId]);

    // Returns sticky positioning for a data cell at (colId, ci, rowId, ri), or {} if unfrozen.
    const getCellSticky = (colId: string, ci: number, rowId: string, ri: number): React.CSSProperties => {
        const isFrozenCol = ci < frozenCols;
        const isFrozenRow = ri < frozenRows;
        if (!isFrozenCol && !isFrozenRow) return {};
        const style: React.CSSProperties = { position: 'sticky' };
        if (isFrozenCol) style.left = colLeftOffsets[colId] ?? 0;
        if (isFrozenRow) style.top = rowTopOffsets[rowId] ?? 0;
        style.zIndex = isFrozenCol && isFrozenRow ? 25 : 10;
        return style;
    };

    // Header "#" corner cell: sticky only on the axes that are actually frozen.
    const getHeaderCornerSticky = (): React.CSSProperties => {
        if (frozenRows === 0 && frozenCols === 0) return {};
        const style: React.CSSProperties = { position: 'sticky', zIndex: 30 };
        if (frozenRows > 0) style.top = 0;
        if (frozenCols > 0) style.left = 0;
        return style;
    };

    // Column header cell: sticky top when any rows are frozen, sticky left when this column is frozen.
    const getHeaderColSticky = (colId: string, ci: number): React.CSSProperties => {
        const leftFrozen = ci < frozenCols;
        const topFrozen = frozenRows > 0;
        if (!leftFrozen && !topFrozen) return {};
        const style: React.CSSProperties = { position: 'sticky', zIndex: leftFrozen ? 30 : 20 };
        if (topFrozen) style.top = 0;
        if (leftFrozen) style.left = colLeftOffsets[colId] ?? 0;
        return style;
    };

    // Trailing "add column" header cell only needs to stay visible when rows are frozen.
    const getAddColThSticky = (): React.CSSProperties =>
        frozenRows > 0 ? { position: 'sticky', top: 0, zIndex: 20 } : {};

    // Row-number gutter cell: sticky left when any columns are frozen, sticky top when this row is frozen.
    const getRowNumSticky = (rowId: string, ri: number): React.CSSProperties => {
        const topFrozen = ri < frozenRows;
        if (frozenCols === 0 && !topFrozen) return {};
        const style: React.CSSProperties = { position: 'sticky', zIndex: 20 };
        if (frozenCols > 0) style.left = 0;
        if (topFrozen) style.top = rowTopOffsets[rowId] ?? 0;
        return style;
    };

    const loadSheets = async () => {
        if (!userId || !characterId) return;
        const items = await getItemsForCharacter(userId, characterId, 'spreadsheets');
        setSheets((items || []) as SpreadsheetDoc[]);
    };

    useEffect(() => { loadSheets(); }, [userId, characterId]);

    const persist = async (cols: SpreadsheetCol[], rws: SpreadsheetRow[], ttl = sheetTitle, fCols = frozenCols, fRows = frozenRows) => {
        if (!currentSheetId || !userId || !characterId) return;
        await updateItemForCharacter(userId, characterId, 'spreadsheets', currentSheetId, { columns: cols, rows: rws, title: ttl, frozenCols: fCols, frozenRows: fRows });
        loadSheets();
    };

    const freezeColumnsUpTo = (ci: number) => {
        const next = ci + 1;
        setFrozenCols(next);
        persist(columns, rows, sheetTitle, next, frozenRows);
    };

    const unfreezeColumns = () => {
        setFrozenCols(0);
        persist(columns, rows, sheetTitle, 0, frozenRows);
    };

    const freezeRowsUpTo = (ri: number) => {
        const next = ri + 1;
        setFrozenRows(next);
        persist(columns, rows, sheetTitle, frozenCols, next);
    };

    const unfreezeRows = () => {
        setFrozenRows(0);
        persist(columns, rows, sheetTitle, frozenCols, 0);
    };

    const createSheet = async () => {
        if (!userId || !characterId) return;
        if (!isAdmin(userId) && sheets.length >= 2) {
            alert('Spreadsheet limit reached. You can have up to 2 spreadsheets at a time.');
            return;
        }
        const id0 = `col_${Date.now()}_0`;
        const id1 = `col_${Date.now() + 1}_1`;
        const defaultCols: SpreadsheetCol[] = [
            { id: id0, header: 'Column 1', type: 'text' },
            { id: id1, header: 'Column 2', type: 'text' },
        ];
        const payload = { title: 'Untitled Sheet', createdAt: Date.now(), columns: defaultCols, rows: [], frozenCols: 0, frozenRows: 0 };
        const newId = await addItemToCharacter(userId, characterId, 'spreadsheets', payload);
        await loadSheets();
        setCurrentSheetId(newId as string);
        setColumns(defaultCols);
        setRows([]);
        setSheetTitle('Untitled Sheet');
        setFrozenCols(0);
        setFrozenRows(0);
    };

    const openSheet = (s: SpreadsheetDoc) => {
        setCurrentSheetId(s.id);
        setColumns(s.columns || []);
        setRows(s.rows || []);
        setSheetTitle(s.title || 'Untitled Sheet');
        setFrozenCols(s.frozenCols ?? 0);
        setFrozenRows(s.frozenRows ?? 0);
        setEditingCell(null);
        setEditingHeader(null);
    };

    const deleteSheet = async () => {
        if (!currentSheetId || !userId || !characterId) return;
        await deleteItemFromCharacter(userId, characterId, 'spreadsheets', currentSheetId);
        setCurrentSheetId(null); setColumns([]); setRows([]); setSheetTitle(''); setFrozenCols(0); setFrozenRows(0);
        await loadSheets();
    };

    const duplicateSheet = async (s: SpreadsheetDoc) => {
        if (!userId || !characterId) return;
        if (!isAdmin(userId) && sheets.length >= 2) {
            alert('Spreadsheet limit reached. You can have up to 2 spreadsheets at a time.');
            return;
        }
        const payload = {
            title: `${s.title || 'Untitled Sheet'} (Copy)`,
            createdAt: Date.now(),
            columns: s.columns || [],
            rows: s.rows || [],
            frozenCols: s.frozenCols ?? 0,
            frozenRows: s.frozenRows ?? 0,
        };
        const newId = await addItemToCharacter(userId, characterId, 'spreadsheets', payload);
        await loadSheets();
        setCurrentSheetId(newId as string);
        setColumns(payload.columns);
        setRows(payload.rows);
        setSheetTitle(payload.title);
        setFrozenCols(payload.frozenCols);
        setFrozenRows(payload.frozenRows);
        setEditingCell(null);
        setEditingHeader(null);
    };

    const addColumn = (type: 'text' | 'checkbox') => {
        const col: SpreadsheetCol = { id: `col_${Date.now()}`, header: `Column ${columns.length + 1}`, type };
        const nextCols = [...columns, col];
        const nextRows = rows.map(r => ({ ...r, cells: { ...r.cells, [col.id]: type === 'checkbox' ? false : '' } }));
        setColumns(nextCols); setRows(nextRows);
        persist(nextCols, nextRows);
    };

    const insertColumnAt = (index: number, type: 'text' | 'checkbox' = 'text') => {
        const col: SpreadsheetCol = { id: `col_${Date.now()}`, header: `Column ${columns.length + 1}`, type };
        const nextCols = [...columns.slice(0, index), col, ...columns.slice(index)];
        const nextRows = rows.map(r => ({ ...r, cells: { ...r.cells, [col.id]: type === 'checkbox' ? false : '' } }));
        setColumns(nextCols); setRows(nextRows);
        persist(nextCols, nextRows);
    };

    const commitHeader = (colId: string, header: string) => {
        const nextCols = columns.map(c => c.id === colId ? { ...c, header } : c);
        setColumns(nextCols);
        persist(nextCols, rows);
        setEditingHeader(null);
    };

    const toggleColType = (colId: string) => {
        const col = columns.find(c => c.id === colId)!;
        const newType: 'text' | 'checkbox' = col.type === 'checkbox' ? 'text' : 'checkbox';
        const nextCols = columns.map(c => c.id === colId ? { ...c, type: newType } : c);
        const nextRows = rows.map(r => ({ ...r, cells: { ...r.cells, [colId]: newType === 'checkbox' ? false : '' } }));
        setColumns(nextCols); setRows(nextRows);
        persist(nextCols, nextRows);
    };

    const deleteColumn = (colId: string) => {
        const nextCols = columns.filter(c => c.id !== colId);
        const nextRows = rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; });
        setColumns(nextCols); setRows(nextRows);
        persist(nextCols, nextRows);
    };

    const addRow = () => {
        const cells: Record<string, string | boolean> = {};
        columns.forEach(c => { cells[c.id] = c.type === 'checkbox' ? false : ''; });
        const nextRows = [...rows, { id: `row_${Date.now()}`, cells }];
        setRows(nextRows);
        persist(columns, nextRows);
    };

    const insertRowAt = (index: number) => {
        const cells: Record<string, string | boolean> = {};
        columns.forEach(c => { cells[c.id] = c.type === 'checkbox' ? false : ''; });
        const newRow: SpreadsheetRow = { id: `row_${Date.now()}`, cells };
        const nextRows = [...rows.slice(0, index), newRow, ...rows.slice(index)];
        setRows(nextRows);
        persist(columns, nextRows);
    };

    const updateCell = (rowId: string, colId: string, value: string | boolean) => {
        const nextRows = rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r);
        setRows(nextRows);
        persist(columns, nextRows);
    };

    const deleteRow = (rowId: string) => {
        const nextRows = rows.filter(r => r.id !== rowId);
        setRows(nextRows);
        persist(columns, nextRows);
    };

    const moveColumnLeft = (colId: string) => {
        const idx = columns.findIndex(c => c.id === colId);
        if (idx <= 0) return;
        const next = [...columns];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        setColumns(next); persist(next, rows);
    };

    const moveColumnRight = (colId: string) => {
        const idx = columns.findIndex(c => c.id === colId);
        if (idx >= columns.length - 1) return;
        const next = [...columns];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        setColumns(next); persist(next, rows);
    };

    const moveRowUp = (rowId: string) => {
        const idx = rows.findIndex(r => r.id === rowId);
        if (idx <= 0) return;
        const next = [...rows];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        setRows(next); persist(columns, next);
    };

    const moveRowDown = (rowId: string) => {
        const idx = rows.findIndex(r => r.id === rowId);
        if (idx >= rows.length - 1) return;
        const next = [...rows];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        setRows(next); persist(columns, next);
    };

    return (
        <div className="flex-1 md:min-h-0 flex flex-col md:flex-row gap-4 md:overflow-hidden">
            {/* Left: sheet list */}
            <div className="w-full md:w-52 shrink-0 md:overflow-auto border rounded p-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">Sheets</div>
                        <button onClick={() => setSheetListCollapsed(v => !v)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs select-none">{sheetListCollapsed ? '▼' : '▲'}</button>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={createSheet} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">New</button>
                        {currentSheetId && <button onClick={deleteSheet} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">Delete</button>}
                    </div>
                </div>
                {!sheetListCollapsed && <>
                {sheets.length === 0 && <div className="text-xs text-gray-500">No sheets yet.</div>}
                <div className="flex flex-col gap-1">
                    {sheets.map(s => (
                        <div key={s.id} onClick={() => openSheet(s)}
                            className={`p-2 border rounded cursor-pointer relative group/tile ${s.id === currentSheetId ? 'bg-cyan-50 border-cyan-300' : 'bg-white hover:bg-gray-50'}`}>
                            <div className="text-sm font-medium truncate pr-5">{s.title || 'Untitled'}</div>
                            <div className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</div>
                            <button
                                onMouseDown={e => { e.stopPropagation(); setOpenSheetMenu(prev => prev === s.id ? null : s.id); }}
                                className="absolute top-1 right-1 opacity-0 group-hover/tile:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 px-1 text-sm leading-none"
                                title="Sheet options">&#8942;</button>
                            {openSheetMenu === s.id && (
                                <div className="absolute right-1 top-6 z-20 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[120px] text-left"
                                    onMouseDown={e => e.stopPropagation()}>
                                    <button onClick={() => { duplicateSheet(s); setOpenSheetMenu(null); }}
                                        className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                        ⧉ Duplicate
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                </>}
            </div>

            {/* Right: sheet editor */}
            <div className="md:flex-1 border rounded p-2 bg-gray-50 flex flex-col md:overflow-hidden">
                {!currentSheetId ? (
                    <div className="m-auto text-sm text-gray-400">Select or create a spreadsheet</div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            {editingTitle ? (
                                <input autoFocus value={sheetTitle}
                                    onChange={e => setSheetTitle(e.target.value)}
                                    onBlur={() => { setEditingTitle(false); persist(columns, rows, sheetTitle); }}
                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                    className="text-xl font-semibold border rounded px-2 py-1 w-full outline-none focus:border-blue-400" />
                            ) : (
                                <div onClick={() => setEditingTitle(true)} className="text-xl font-semibold cursor-pointer hover:text-blue-600 select-none">{sheetTitle || 'Untitled Sheet'}</div>
                            )}
                            <button onClick={() => setSheetViewCollapsed(v => !v)} className="ml-2 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs select-none flex-shrink-0">{sheetViewCollapsed ? '▼ Show' : '▲ Hide'}</button>
                        </div>
                        {!sheetViewCollapsed && <>
                        <div className="overflow-x-auto md:overflow-auto md:flex-1">
                            <table className="text-sm border-collapse w-max">
                                <thead>
                                    <tr>
                                        <th ref={rowNumHeaderRef} className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs text-gray-400 w-8" style={getHeaderCornerSticky()}>#</th>
                                        {columns.map((col, ci) => (
                                            <th key={col.id} ref={el => { colHeaderRefs.current[col.id] = el; }}
                                                className="border border-gray-300 bg-gray-100 px-2 py-1 min-w-[130px] group relative"
                                                style={getHeaderColSticky(col.id, ci)}>
                                                <div className="flex items-center justify-between gap-1">
                                                    {editingHeader === col.id ? (
                                                        <input autoFocus value={editingHeaderDraft}
                                                            onChange={e => setEditingHeaderDraft(e.target.value)}
                                                            onBlur={() => commitHeader(col.id, editingHeaderDraft || col.header)}
                                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingHeader(null); }}
                                                            className="w-full border rounded px-1 py-0.5 text-xs text-center outline-none focus:border-blue-400" />
                                                    ) : (
                                                        <div onClick={() => { setEditingHeader(col.id); setEditingHeaderDraft(col.header); }}
                                                            className="font-semibold cursor-pointer hover:text-blue-600 select-none flex-1 text-center">{col.header}</div>
                                                    )}
                                                    <button
                                                        onMouseDown={e => { e.stopPropagation(); setOpenColMenu(prev => prev === col.id ? null : col.id); }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 px-0.5 text-sm leading-none flex-shrink-0"
                                                        title="Column options">&#8942;</button>
                                                </div>
                                                {openColMenu === col.id && (
                                                    <div className="absolute right-0 top-full mt-0.5 z-20 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[140px] text-left"
                                                        onMouseDown={e => e.stopPropagation()}>
                                                        <button onClick={() => { moveColumnLeft(col.id); setOpenColMenu(null); }} disabled={ci === 0}
                                                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${ci === 0 ? 'text-gray-300 cursor-default' : 'text-gray-700'}`}>
                                                            ◀ Move left
                                                        </button>
                                                        <button onClick={() => { moveColumnRight(col.id); setOpenColMenu(null); }} disabled={ci === columns.length - 1}
                                                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${ci === columns.length - 1 ? 'text-gray-300 cursor-default' : 'text-gray-700'}`}>
                                                            ▶ Move right
                                                        </button>
                                                        <div className="border-t border-gray-100 my-1" />
                                                        <button onClick={() => { insertColumnAt(ci); setOpenColMenu(null); }}
                                                            className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                            ◀+ Insert column
                                                        </button>
                                                        <button onClick={() => { insertColumnAt(ci + 1); setOpenColMenu(null); }}
                                                            className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                            +▶ Insert column
                                                        </button>
                                                        <div className="border-t border-gray-100 my-1" />
                                                        <button onClick={() => { toggleColType(col.id); setOpenColMenu(null); }}
                                                            className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                            {col.type === 'checkbox' ? '☑→T Switch to text' : 'T→☑ Switch to checkbox'}
                                                        </button>
                                                        <div className="border-t border-gray-100 my-1" />
                                                        <button onClick={() => { freezeColumnsUpTo(ci); setOpenColMenu(null); }}
                                                            className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                            📌 Freeze up to here
                                                        </button>
                                                        {frozenCols > 0 && (
                                                            <button onClick={() => { unfreezeColumns(); setOpenColMenu(null); }}
                                                                className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                                🚫 Unfreeze columns
                                                            </button>
                                                        )}
                                                        <div className="border-t border-gray-100 my-1" />
                                                        <button onClick={() => { deleteColumn(col.id); setOpenColMenu(null); }}
                                                            className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50">
                                                            ✕ Delete column
                                                        </button>
                                                    </div>
                                                )}
                                            </th>
                                        ))}
                                        <th className="border border-gray-300 bg-gray-100 px-2 py-1" style={getAddColThSticky()}>
                                            <div className="flex flex-col items-center gap-1">
                                                <button onClick={() => addColumn('text')} title="Add text column" className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded whitespace-nowrap">+T</button>
                                                <button onClick={() => addColumn('checkbox')} title="Add checkbox column" className="text-[11px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded whitespace-nowrap">+☑</button>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, ri) => {
                                        const isTotal = isTotalRow(row);
                                        return (
                                            <tr key={row.id} ref={el => { dataRowRefs.current[row.id] = el; }} className={isTotal ? 'bg-amber-50 font-semibold' : 'hover:bg-gray-50'}>
                                                <td className="border border-gray-200 px-1 py-1 bg-gray-50 select-none group/row relative" style={getRowNumSticky(row.id, ri)}>
                                                    <div className="flex items-center justify-center gap-0.5 min-w-[1.5rem]">
                                                        <span className="text-xs text-gray-400 leading-tight">{ri + 1}</span>
                                                        <button
                                                            onMouseDown={e => { e.stopPropagation(); setOpenRowMenu(prev => prev === row.id ? null : row.id); }}
                                                            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 text-sm leading-none"
                                                            title="Row options">&#8942;</button>
                                                    </div>
                                                    {openRowMenu === row.id && (
                                                        <div className="absolute left-full top-0 ml-0.5 z-20 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[130px]"
                                                            onMouseDown={e => e.stopPropagation()}>
                                                            <button onClick={() => { moveRowUp(row.id); setOpenRowMenu(null); }} disabled={ri === 0}
                                                                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${ri === 0 ? 'text-gray-300 cursor-default' : 'text-gray-700'}`}>
                                                                ▲ Move up
                                                            </button>
                                                            <button onClick={() => { moveRowDown(row.id); setOpenRowMenu(null); }} disabled={ri === rows.length - 1}
                                                                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${ri === rows.length - 1 ? 'text-gray-300 cursor-default' : 'text-gray-700'}`}>
                                                                ▼ Move down
                                                            </button>
                                                            <div className="border-t border-gray-100 my-1" />
                                                            <button onClick={() => { insertRowAt(ri); setOpenRowMenu(null); }}
                                                                className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                                ▲+ Insert row
                                                            </button>
                                                            <button onClick={() => { insertRowAt(ri + 1); setOpenRowMenu(null); }}
                                                                className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                                +▼ Insert row
                                                            </button>
                                                            <div className="border-t border-gray-100 my-1" />
                                                            <button onClick={() => { freezeRowsUpTo(ri); setOpenRowMenu(null); }}
                                                                className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                                📌 Freeze up to here
                                                            </button>
                                                            {frozenRows > 0 && (
                                                                <button onClick={() => { unfreezeRows(); setOpenRowMenu(null); }}
                                                                    className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50">
                                                                    🚫 Unfreeze rows
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                {columns.map((col, ci) => {
                                                    const cellSticky = getCellSticky(col.id, ci, row.id, ri);
                                                    if (isTotal) {
                                                        const raw = String(row.cells[col.id] ?? '').trim();
                                                        const isTrigger = raw.toLowerCase() === 'total';
                                                        if (isTrigger) {
                                                            return (
                                                                <td key={col.id} className="border border-amber-300 px-1 py-1 bg-amber-100" style={cellSticky}>
                                                                    <div className="min-h-[1.5rem] min-w-[100px] px-1 text-sm font-bold text-amber-800 select-none">Total</div>
                                                                </td>
                                                            );
                                                        }
                                                        if (col.type === 'text') {
                                                            const { sum, hasNumbers } = computeColTotal(rows, col.id, ri);
                                                            const display = hasNumbers
                                                                ? (Number.isInteger(sum) ? sum.toString() : sum.toFixed(2))
                                                                : '';
                                                            return (
                                                                <td key={col.id} className="border border-amber-300 px-1 py-1 bg-amber-50" style={cellSticky}>
                                                                    <div className="min-h-[1.5rem] min-w-[100px] px-1 text-sm font-bold text-blue-700 select-none">{display}</div>
                                                                </td>
                                                            );
                                                        }
                                                        // checkbox column in a total row — leave blank
                                                        return <td key={col.id} className="border border-amber-300 px-1 py-1 bg-amber-50" style={cellSticky} />;
                                                    }
                                                    return (
                                                        <td key={col.id} className="border border-gray-200 px-1 py-1 bg-white" style={cellSticky}>
                                                            {col.type === 'checkbox' ? (
                                                                <div className="flex justify-center">
                                                                    <input type="checkbox"
                                                                        checked={!!row.cells[col.id]}
                                                                        onChange={e => updateCell(row.id, col.id, e.target.checked)}
                                                                        className="w-4 h-4 cursor-pointer accent-purple-600" />
                                                                </div>
                                                            ) : editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                                                                <input autoFocus
                                                                    value={String(row.cells[col.id] ?? '')}
                                                                    onChange={e => updateCell(row.id, col.id, e.target.value)}
                                                                    onBlur={() => setEditingCell(null)}
                                                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                                                                    className="w-full outline-none border-none bg-blue-50 px-1 py-0.5 text-sm min-w-[100px]" />
                                                            ) : (
                                                                <div onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
                                                                    className="min-h-[1.5rem] min-w-[100px] px-1 cursor-pointer rounded hover:bg-blue-50 text-sm">
                                                                    {String(row.cells[col.id] ?? '')}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="border border-gray-200 px-1 py-1 bg-white">
                                                    <button onClick={() => deleteRow(row.id)} className="text-[10px] px-1 py-0.5 bg-red-100 text-red-500 rounded">✕</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <button onClick={addRow} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium">+ Add Row</button>
                        </div>                        </>}                    </>
                )}
            </div>
        </div>
    );
};

const MapModal: React.FC<Props> = ({ onClose, userId, characterId }) => {
    const [roots, setRoots] = useState<MapNode[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [editingMapTitleFor, setEditingMapTitleFor] = useState<string | null>(null);
    const [mapTitleDraftLocal, setMapTitleDraftLocal] = useState<string>('');
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapTitleInputRef = useRef<HTMLInputElement | null>(null);
    const [maps, setMaps] = useState<any[]>([]);
    const [currentMapId, setCurrentMapId] = useState<string | null>(null);
    const [mapTitle, setMapTitle] = useState<string>('Untitled Map');
    const [expandedMaps, setExpandedMaps] = useState<Record<string, boolean>>({});
    const [editNodeForMap, setEditNodeForMap] = useState<Record<string, string | null>>({});
    const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
    const [mode, setMode] = useState<'maps' | 'spreadsheets' | 'qrcode'>('maps');
    const [mapTransform, setMapTransform] = useState({ x: 0, y: 0, z: 1 });
    const [isDraggingMap, setIsDraggingMap] = useState(false);
    const [mapViewCollapsed, setMapViewCollapsed] = useState(false);
    const mapDragRef = useRef({ active: false, x0: 0, y0: 0, px0: 0, py0: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
    const mapFitRef = useRef<() => void>(() => {});

    // Re-fit when the loaded map changes
    useEffect(() => {
        const t = setTimeout(() => mapFitRef.current(), 120);
        return () => clearTimeout(t);
    }, [currentMapId]);

    // Non-passive wheel listener so we can preventDefault and zoom without scrolling the page
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            setMapTransform(t => {
                const nz = Math.max(0.05, Math.min(8, t.z * factor));
                return { z: nz, x: cx - (cx - t.x) * (nz / t.z), y: cy - (cy - t.y) * (nz / t.z) };
            });
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, [mode, currentMapId]);

    const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        mapDragRef.current = { active: true, x0: e.clientX, y0: e.clientY, px0: mapTransform.x, py0: mapTransform.y };
        setIsDraggingMap(true);
    };
    const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!mapDragRef.current.active) return;
        setMapTransform(t => ({ ...t, x: mapDragRef.current.px0 + (e.clientX - mapDragRef.current.x0), y: mapDragRef.current.py0 + (e.clientY - mapDragRef.current.y0) }));
    };
    const stopMapDrag = () => { mapDragRef.current.active = false; setIsDraggingMap(false); };
    const onSvgTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
        if (e.touches.length !== 1) return;
        mapDragRef.current = { active: true, x0: e.touches[0].clientX, y0: e.touches[0].clientY, px0: mapTransform.x, py0: mapTransform.y };
    };
    const onSvgTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
        if (e.touches.length !== 1 || !mapDragRef.current.active) return;
        setMapTransform(t => ({ ...t, x: mapDragRef.current.px0 + (e.touches[0].clientX - mapDragRef.current.x0), y: mapDragRef.current.py0 + (e.touches[0].clientY - mapDragRef.current.y0) }));
    };

    const addRoot = (title?: string) => {
        const t = title ?? newTitle;
        if (!t || !t.trim()) return null;
        const n: MapNode = { id: Date.now().toString() + Math.random().toString(36).slice(2), title: t.trim(), color: '#ffffff', children: [] };
        const next = [...roots, n];
        setRoots(next);
        setNewTitle('');
        // persist to current map if present
        if (currentMapId && userId && characterId) {
            updateItemForCharacter(userId, characterId, 'maps', currentMapId, { nodes: next }).then(() => loadMapsForCharacter()).catch(console.error);
        }
        return n.id;
    };

    const addChild = (parentId: string, title = 'New') => {
        const childId = Date.now().toString() + Math.random().toString(36).slice(2);
        const next = addChildRec(roots, parentId, title, childId);
        setRoots(next);
        // set edit flag for this new child
        if (currentMapId) setEditNodeForMap((s) => ({ ...s, [currentMapId]: childId }));
        if (currentMapId && userId && characterId) {
            updateItemForCharacter(userId, characterId, 'maps', currentMapId, { nodes: next }).then(() => loadMapsForCharacter()).catch(console.error);
        }
        return childId;
    };

    const addChildRec = (nodes: MapNode[], parentId: string, title: string, newId?: string): MapNode[] => {
        return nodes.map((n) => {
            if (n.id === parentId) {
                const child: MapNode = { id: newId ?? (Date.now().toString() + Math.random().toString(36).slice(2)), title, color: '#ffffff', children: [] };
                return { ...n, children: [...(n.children || []), child] };
            }
            return { ...n, children: n.children ? addChildRec(n.children, parentId, title, newId) : [] };
        });
    };

    // Firestore helpers
    const loadMapsForCharacter = async () => {
        if (!userId || !characterId) return;
        const items = await getItemsForCharacter(userId, characterId, 'maps');
        setMaps(items || []);
    };

    // helper to add a child to a map (works whether the map is selected or not)
    const addChildToMap = async (mapId: string, parentId: string, title = 'New') => {
        if (!mapId) return;
        // if map is currently open in editor, use local addChild which updates roots and persists
        if (mapId === currentMapId) {
            const childId = addChild(parentId, title);
            // ensure left pane shows map expanded and the new node in edit mode
            setExpandedMaps((s) => ({ ...s, [mapId]: true }));
            setEditNodeForMap((s) => ({ ...s, [mapId]: childId }));
            return;
        }
        // otherwise update the stored map doc directly
        try {
            const map = maps.find((m) => m.id === mapId);
            const nodes = map?.nodes || [];
            const childId = Date.now().toString() + Math.random().toString(36).slice(2);
            const next = addChildRec(nodes, parentId, title, childId);
            if (userId && characterId) {
                await updateItemForCharacter(userId, characterId, 'maps', mapId, { nodes: next });
                await loadMapsForCharacter();
                // expand and open map and set edit flag
                setExpandedMaps((s) => ({ ...s, [mapId]: true }));
                // load the map so editor shows it
                const updatedMap = (await getItemsForCharacter(userId, characterId, 'maps')).find((mm: any) => mm.id === mapId);
                if (updatedMap) loadMap(updatedMap);
                setEditNodeForMap((s) => ({ ...s, [mapId]: childId }));
            }
        } catch (err) {
            console.error('addChildToMap error', err);
        }
    };

    // add a top-level root node to a map (works for open or closed maps)
    const addRootToMap = async (mapId: string, title = 'New') => {
        if (!mapId) return;
        // if map is currently open, use local addRoot which updates roots and persists
        if (mapId === currentMapId) {
            const rootId = addRoot(title);
            if (rootId) {
                setExpandedMaps((s) => ({ ...s, [mapId]: true }));
                setEditNodeForMap((s) => ({ ...s, [mapId]: rootId }));
            }
            return;
        }
        try {
            const map = maps.find((m) => m.id === mapId);
            const nodes = map?.nodes || [];
            const rootId = Date.now().toString() + Math.random().toString(36).slice(2);
            const next = [...nodes, { id: rootId, title, color: '#ffffff', children: [] }];
            if (userId && characterId) {
                await updateItemForCharacter(userId, characterId, 'maps', mapId, { nodes: next });
                await loadMapsForCharacter();
                setExpandedMaps((s) => ({ ...s, [mapId]: true }));
                const updatedMap = (await getItemsForCharacter(userId, characterId, 'maps')).find((mm: any) => mm.id === mapId);
                if (updatedMap) loadMap(updatedMap);
                setEditNodeForMap((s) => ({ ...s, [mapId]: rootId }));
            }
        } catch (err) {
            console.error('addRootToMap error', err);
        }
    };

    // helper to update a node's title in a map (works for selected or non-selected maps)
    const updateNodeInMap = async (mapId: string, nodeId: string, patch: string | { title?: string; color?: string }) => {
        if (!mapId) return;
        if (mapId === currentMapId) {
            if (typeof patch === 'string') updateTitle(nodeId, patch);
            else {
                if (patch.title) updateTitle(nodeId, patch.title);
                if (patch.color) {
                    const next = updateRec(roots, nodeId, { color: patch.color });
                    setRoots(next);
                    if (currentMapId && userId && characterId) {
                        updateItemForCharacter(userId, characterId, 'maps', currentMapId, { nodes: next }).then(() => loadMapsForCharacter()).catch(console.error);
                    }
                }
            }
            return;
        }
        try {
            const map = maps.find((m) => m.id === mapId);
            const nodes = map?.nodes || [];
            const next = updateRec(nodes, nodeId, patch);
            if (userId && characterId) {
                await updateItemForCharacter(userId, characterId, 'maps', mapId, { nodes: next });
                await loadMapsForCharacter();
            }
            setEditNodeForMap((s) => ({ ...s, [mapId]: null }));
        } catch (err) {
            console.error('updateNodeInMap error', err);
        }
    };

    // helper to remove a node from a map
    const removeNodeFromMap = async (mapId: string, nodeId: string) => {
        if (!mapId) return;
        if (mapId === currentMapId) {
            removeNode(nodeId);
            return;
        }
        try {
            const map = maps.find((m) => m.id === mapId);
            const nodes = map?.nodes || [];
            const next = removeRec(nodes, nodeId);
            if (userId && characterId) {
                await updateItemForCharacter(userId, characterId, 'maps', mapId, { nodes: next });
                await loadMapsForCharacter();
            }
            setEditNodeForMap((s) => ({ ...s, [mapId]: null }));
        } catch (err) {
            console.error('removeNodeFromMap error', err);
        }
    };

    useEffect(() => {
        loadMapsForCharacter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, characterId]);

    // autofocus map title input when editing a map title
    useEffect(() => {
        if (editingMapTitleFor && mapTitleInputRef.current) {
            mapTitleInputRef.current.focus();
            const v = mapTitleInputRef.current.value;
            mapTitleInputRef.current.setSelectionRange(v.length, v.length);
        }
    }, [editingMapTitleFor]);

    const createMap = async () => {
        if (!isAdmin(userId) && maps.length >= 2) {
            alert('Map limit reached. You can have up to 2 maps at a time.');
            return;
        }
        if (!userId || !characterId) {
            // create a local temporary map
            const m = { id: Date.now().toString(), title: 'Untitled Map', createdAt: Date.now(), nodes: roots };
            setMaps((s) => [...s, m]);
            setCurrentMapId(m.id);
            return;
        }
        const payload = { title: 'Untitled Map', nodes: [], createdAt: Date.now() };
        const id = await addItemToCharacter(userId, characterId, 'maps', payload);
        await loadMapsForCharacter();
        setCurrentMapId(id as string);
        setRoots([]);
        setMapTitle('Untitled Map');
    };

    const loadMap = (m: any) => {
        setCurrentMapId(m.id);
        setRoots(m.nodes || []);
        setMapTitle(m.title || 'Untitled Map');
    };

    const saveCurrentMap = async () => {
        if (!currentMapId) return;
        const payload = { title: mapTitle, nodes: roots };
        if (userId && characterId) {
            await updateItemForCharacter(userId, characterId, 'maps', currentMapId, payload);
            await loadMapsForCharacter();
        }
    };

    const deleteMap = async () => {
        if (!currentMapId) return;
        if (userId && characterId) {
            await deleteItemFromCharacter(userId, characterId, 'maps', currentMapId);
            setCurrentMapId(null);
            setRoots([]);
            await loadMapsForCharacter();
        }
    };

    const updateTitle = (id: string, title: string) => {
        const next = updateRec(roots, id, title);
        setRoots(next);
        if (currentMapId && userId && characterId) {
            updateItemForCharacter(userId, characterId, 'maps', currentMapId, { nodes: next }).then(() => loadMapsForCharacter()).catch(console.error);
        }
    };

    const updateRec = (nodes: MapNode[], id: string, patch: string | { title?: string; color?: string }): MapNode[] => {
        return nodes.map((n) => {
            const isMatch = n.id === id;
            let newNode = { ...n } as MapNode;
            if (isMatch) {
                if (typeof patch === 'string') {
                    newNode.title = patch;
                } else {
                    if (patch.title !== undefined) newNode.title = patch.title;
                    if (patch.color !== undefined) newNode.color = patch.color;
                }
            }
            return { ...newNode, children: n.children ? updateRec(n.children, id, patch) : [] };
        });
    };

    const removeNode = (id: string) => {
        const next = removeRec(roots, id);
        setRoots(next);
        if (currentMapId && userId && characterId) {
            updateItemForCharacter(userId, characterId, 'maps', currentMapId, { nodes: next }).then(() => loadMapsForCharacter()).catch(console.error);
        }
    };

    const removeRec = (nodes: MapNode[], id: string): MapNode[] => {
        return nodes
            .filter((n) => n.id !== id)
            .map((n) => ({ ...n, children: n.children ? removeRec(n.children, id) : [] }));
    };

    // layout: simple xy positions per depth and index
    const computePositions = (nodes: MapNode[]) => {
        const positions: { id: string; x: number; y: number; title: string; color?: string }[] = [];
        const levelGap = 160;
        const nodeGap = 140;
        const traverse = (arr: MapNode[], depth: number, xOffsetRef: { v: number }) => {
            arr.forEach((n) => {
                const x = xOffsetRef.v * nodeGap;
                const y = depth * levelGap;
                positions.push({ id: n.id, x, y, title: n.title, color: n.color || '#ffffff' });
                xOffsetRef.v += 1;
                if (n.children && n.children.length > 0) traverse(n.children, depth + 1, xOffsetRef);
            });
        };
        traverse(nodes, 0, { v: 0 });
        return positions;
    };

    const positions = computePositions(roots);

    // compute bbox and scale to fit
    const bbox = positions.length > 0 ? {
        minX: Math.min(...positions.map(p => p.x)) - 80,
        minY: Math.min(...positions.map(p => p.y)) - 60,
        maxX: Math.max(...positions.map(p => p.x)) + 80,
        maxY: Math.max(...positions.map(p => p.y)) + 60,
    } : { minX: 0, minY: 0, maxX: 600, maxY: 400 };

    const width = bbox.maxX - bbox.minX || 600;
    const height = bbox.maxY - bbox.minY || 400;

    // Always keep mapFitRef up to date with the latest layout values
    mapFitRef.current = () => {
        const el = svgRef.current;
        if (!el || !positions.length) { setMapTransform({ x: 0, y: 0, z: 1 }); return; }
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const PAD = 40;
        const s = Math.max(0.05, Math.min(3, Math.min((rect.width - PAD * 2) / width, (rect.height - PAD * 2) / height)));
        setMapTransform({ z: s, x: rect.width / 2 - (bbox.minX + width / 2) * s, y: rect.height / 2 - (bbox.minY + height / 2) * s });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-start md:items-center justify-center overflow-y-auto md:overflow-hidden py-4 md:py-0">
            <div className="bg-white rounded-lg w-[94%] my-4 md:my-0 h-auto md:h-[92%] p-4 md:overflow-hidden flex flex-col" ref={containerRef}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-1">
                        <button onClick={() => setMode('maps')} className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${mode === 'maps' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Maps</button>
                        <button onClick={() => setMode('spreadsheets')} className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${mode === 'spreadsheets' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Spreadsheets</button>
                        <button onClick={() => setMode('qrcode')} className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${mode === 'qrcode' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>QR Code</button>
                    </div>
                    <button onClick={onClose} className="px-3 py-2 bg-gray-200 rounded">Save & Exit</button>
                </div>

                {mode === 'maps' && (<div className="flex-1 md:min-h-0 flex flex-col md:overflow-hidden">
                {leftCollapsed && (
                    <div className="mb-2">
                        <button onClick={(e) => { e.stopPropagation(); setLeftCollapsed(false); }} title="Expand" className="px-2 py-1 bg-gray-100 rounded text-xs">▶</button>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 flex-1 md:min-h-0 md:overflow-hidden">
                    {!leftCollapsed && (
                        <div className="w-full md:w-1/3 md:min-w-[240px] shrink-0 md:overflow-auto border rounded p-2">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold">Maps</div>
                                    <button onClick={(e) => { e.stopPropagation(); setLeftCollapsed(s => !s); }} title={leftCollapsed ? 'Expand' : 'Collapse'} className="px-2 py-1 bg-gray-100 rounded text-xs">◀</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={createMap} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">New Map</button>
                                    {currentMapId && <button onClick={deleteMap} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">Delete</button>}
                                </div>
                            </div>
                            {maps.length === 0 && <div className="text-xs text-gray-500">No maps yet. Create one.</div>}
                            <div className="flex flex-col gap-2">
                                {maps.map((m) => (
                                    <div key={m.id}>
                                        <div onClick={() => loadMap(m)} className={`p-2 border rounded flex items-center justify-between cursor-pointer ${m.id === currentMapId ? 'bg-cyan-50' : 'bg-white'}`}>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setExpandedMaps((s) => ({ ...s, [m.id]: !s[m.id] })); }} className="px-2 py-1 bg-gray-100 rounded text-xs">{expandedMaps[m.id] ? '▾' : '▸'}</button>
                                                <div>
                                                    {editingMapTitleFor === m.id ? (
                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                                                            <input ref={mapTitleInputRef} value={mapTitleDraftLocal} onChange={(e) => setMapTitleDraftLocal(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
                                                            <div className="flex gap-2 w-full sm:w-auto">
                                                                <button onClick={async (e) => { e.stopPropagation(); if (userId && characterId) { await updateItemForCharacter(userId, characterId, 'maps', m.id, { title: mapTitleDraftLocal }); await loadMapsForCharacter(); if (m.id === currentMapId) setMapTitle(mapTitleDraftLocal); } setEditingMapTitleFor(null); }} className="px-2 py-1 bg-emerald-500 text-white rounded text-xs w-full sm:w-auto">Save</button>
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingMapTitleFor(null); setMapTitleDraftLocal(''); }} className="px-2 py-1 bg-gray-200 rounded text-xs w-full sm:w-auto">Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div onClick={(e) => { e.stopPropagation(); loadMap(m); setEditingMapTitleFor(m.id); setMapTitleDraftLocal(m.title || ''); }} className="text-sm font-medium cursor-pointer hover:text-blue-600">{m.title || 'Untitled'}</div>
                                                            <div className="text-xs text-gray-500">{new Date((m.createdAt || Date.now())).toLocaleString()}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); addRootToMap(m.id); }} title="Add top-level category" className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">+</button>
                                            </div>
                                        </div>

                                        {expandedMaps[m.id] && (
                                            <div className="mt-1 ml-6">
                                                {(m.nodes || []).length === 0 && <div className="text-xs text-gray-500">No categories</div>}
                                                {(m.nodes || []).map((n: any) => (
                                                    <CategoryListView key={n.id} node={n} mapId={m.id} onAddChild={addChildToMap} onUpdateNode={updateNodeInMap} onRemoveNode={removeNodeFromMap} editNodeId={editNodeForMap[m.id]} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="md:flex-1 md:min-h-0 border rounded p-2 bg-gray-50 relative flex flex-col md:overflow-hidden">
                        <div className="mb-3 px-2 flex items-center justify-between">
                            <div>
                                {currentMapId ? (
                                    <div className="text-xl font-semibold">{mapTitle || 'Untitled Map'}</div>
                                ) : (
                                    <div className="text-sm text-gray-500">Select a map to view or edit</div>
                                )}
                            </div>
                            <button onClick={() => setMapViewCollapsed(v => !v)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs select-none">{mapViewCollapsed ? '▼ Show Map' : '▲ Hide Map'}</button>
                        </div>
                        {!mapViewCollapsed && <div className="h-[300px] md:h-auto md:flex-1 md:min-h-0 relative overflow-hidden">
                            {/* Zoom toolbar */}
                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 pointer-events-auto">
                                <button onClick={() => setMapTransform(t => ({ ...t, z: Math.min(t.z * 1.25, 8) }))} className="w-7 h-7 bg-white border border-gray-300 rounded shadow text-base font-bold leading-none flex items-center justify-center hover:bg-gray-50 select-none">+</button>
                                <button onClick={() => setMapTransform(t => ({ ...t, z: Math.max(t.z / 1.25, 0.05) }))} className="w-7 h-7 bg-white border border-gray-300 rounded shadow text-base font-bold leading-none flex items-center justify-center hover:bg-gray-50 select-none">−</button>
                                <button onClick={() => mapFitRef.current()} title="Fit to screen" className="w-7 h-7 bg-white border border-gray-300 rounded shadow text-sm flex items-center justify-center hover:bg-gray-50 select-none">⊡</button>
                            </div>
                            <svg
                                ref={svgRef}
                                className="w-full h-full"
                                style={{ cursor: isDraggingMap ? 'grabbing' : 'grab' }}
                                onMouseDown={onSvgMouseDown}
                                onMouseMove={onSvgMouseMove}
                                onMouseUp={stopMapDrag}
                                onMouseLeave={stopMapDrag}
                                onTouchStart={onSvgTouchStart}
                                onTouchMove={onSvgTouchMove}
                                onTouchEnd={stopMapDrag}
                            >
                                <g transform={`translate(${mapTransform.x},${mapTransform.y}) scale(${mapTransform.z})`}>
                                    {roots.map((r) => renderEdgesRecursive(r, positions))}
                                    {positions.map((p) => (
                                        <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                                            <rect x={-48} y={-48} width={96} height={50} rx={14} ry={14} fill={p.color || '#ffffff'} stroke="#94a3b8" strokeWidth={2} />
                                            <text x={0} y={-20} fill="#0f172a" fontSize={12} textAnchor="middle" dominantBaseline="middle">{p.title}</text>
                                        </g>
                                    ))}
                                </g>
                            </svg>
                        </div>}
                    </div>
                </div>
                </div>)}
                {mode === 'spreadsheets' && (
                    <SpreadsheetPanel userId={userId} characterId={characterId} />
                )}
                {mode === 'qrcode' && (
                    <div className="flex-1 md:min-h-0 overflow-auto">
                        <QrCodeGenerator />
                    </div>
                )}
            </div>
        </div>
    );
};



// helper to render edges recursively as SVG lines
const renderEdgesRecursive = (node: MapNode, positions: { id: string; x: number; y: number; title: string; color?: string }[]) => {
    const lines: React.ReactNode[] = [];
    const findPos = (id: string) => positions.find((p) => p.id === id) || { x: 0, y: 0, title: '' };
    const recurse = (n: MapNode) => {
        if (!n.children) return;
        const parentPos = findPos(n.id);
        n.children.forEach((c) => {
            const childPos = findPos(c.id);
            lines.push(
                <line key={`${n.id}-${c.id}`} x1={parentPos.x} y1={parentPos.y + 2} x2={childPos.x} y2={childPos.y - 36} stroke="#cbd5e1" strokeWidth={2} />
            );
            recurse(c);
        });
    };
    recurse(node);
    return <g>{lines}</g>;
};

export default MapModal;
