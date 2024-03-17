// /src/DraggableTextField.tsx
import React from 'react';
import { useDrag } from 'react-dnd';
import TextField from '@mui/material/TextField';

interface DraggableTextFieldProps {
  id: string;
  type: string;
  index: number;
  moveTextField: (dragIndex: number, hoverIndex: number) => void;
}

const DraggableTextField: React.FC<DraggableTextFieldProps> = ({ id, type, index, moveTextField }) => {
  const [, drag] = useDrag(() => ({
    type,
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [id, index]);

  return (
    <div ref={drag}>
      <TextField label={`Field ${index + 1}`} variant="outlined" />
    </div>
  );
};

export default DraggableTextField;
