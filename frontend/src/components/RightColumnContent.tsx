const rows = ["Items", "Row 2"];

const RightColumnContent: React.FC = () => {
  return (
    <div className="right-column-content">
      {rows.map((row, index) => (
        <div key={index} className="right-column-content__row">
          {row}
        </div>
      ))}
    </div>
  );
};
export default RightColumnContent;
 