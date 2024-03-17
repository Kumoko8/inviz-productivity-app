// /src/FormComponent.tsx
import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Grid from '@mui/material/Grid';
import DraggableTextField from './DraggableTextField';

const textFieldType = 'text';

const FormComponent: React.FC = () => {
  const [textFields, setTextFields] = useState(Array.from({ length: 10 }, (_, i) => i));

  const moveTextField = (dragIndex: number, hoverIndex: number) => {
    const dragItem = textFields[dragIndex];
    const hoverItem = textFields[hoverIndex];
    // Swap positions in the array
    const updatedTextFields = [...textFields];
    updatedTextFields[dragIndex] = hoverItem;
    updatedTextFields[hoverIndex] = dragItem;
    setTextFields(updatedTextFields);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Grid container spacing={2}>
        {textFields.map((_, index) => (
          <Grid key={index} item xs={6}>
            <DraggableTextField
              id={`textfield-${index}`}
              type={textFieldType}
              index={index}
              moveTextField={moveTextField}
            />
          </Grid>
        ))}
      </Grid>
    </DndProvider>
  );
};

export default FormComponent;
