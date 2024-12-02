import React from "react";
import MainForm from "./components/MainForm";
import LeftColumnContent from "./components/LeftColumnContent";
import RightColumnContent from "./components/RightColumnContent";
import Header from "./components/Header";


function App() {
  return (
<div>
<Header />
  <MainForm 
  leftContent={<LeftColumnContent />}
  rightContent={<RightColumnContent />}/>
</div>
  ) 
}

export default App;
