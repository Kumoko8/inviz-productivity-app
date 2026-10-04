import React from 'react';
import MessageList from './MessageList';

const NotesBubble: React.FC<{ characterId: string; disabled?: boolean }> = ({ characterId, disabled = false }) => {
    return (
        <MessageList
            characterId={characterId}
            collectionName="notes"
            title="Notes"
            placeholder="Enter note..."
            defaultColor="#fff8e1"
            disabled={disabled}
            titleClassName="text-lg font-semibold text-black"
            showSearch={true}
        />
    );
};

export default NotesBubble;
