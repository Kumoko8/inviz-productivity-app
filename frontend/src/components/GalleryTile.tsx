import React from "react";

type Props = {
    name: string;
    url?: string;
};

const GalleryTile: React.FC<Props> = ({ name, url }) => {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                {url ? (
                    <video src={url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="text-xs text-gray-500 px-2">No preview</div>
                )}
            </div>
            <div className="text-sm font-medium text-gray-700">{name}</div>
        </div>
    );
};

export default GalleryTile;
