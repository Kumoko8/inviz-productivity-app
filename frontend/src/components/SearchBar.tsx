import React, { useState, useEffect } from 'react';

interface Props {
    initialKeyword?: string;
    onChange: (filters: { keyword?: string }) => void;
    placeholder?: string;
    initiallyCollapsed?: boolean;
}

const SearchBar: React.FC<Props> = ({ initialKeyword = '', onChange, placeholder = 'Search notes...', initiallyCollapsed = false }) => {
    const [keyword, setKeyword] = useState(initialKeyword);
    const [collapsed, setCollapsed] = useState(initiallyCollapsed);

    useEffect(() => {
        onChange({ keyword: keyword || undefined });
    }, [keyword]);

    return (
        <div className="mb-3 w-full box-border min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2 w-full min-w-0 box-border">
                <button
                    onClick={() => setCollapsed(c => !c)}
                    aria-expanded={!collapsed}
                    className="text-sm font-medium text-gray-700 hover:underline focus:outline-none cursor-pointer"
                >
                    Search
                </button>
            </div>

            {!collapsed && (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch w-full">
                    <input
                        aria-label="Search keyword"
                        className="border rounded px-3 py-2 w-full sm:flex-1 min-w-0"
                        placeholder={placeholder}
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />

                    <div className="flex sm:flex-none w-full sm:w-auto">
                        <button onClick={() => setKeyword('')} className="px-3 py-2 bg-gray-100 rounded w-full sm:w-auto flex-shrink-0">Clear</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
