import React from "react";
import { UserProvider } from "./context/UserContext"; // wherever your context is
import MainForm from "./components/MainForm";
import LeftColumnContent from "./components/LeftColumnContent";
import RightColumnContent from "./components/RightColumnContent";
import Header from "./components/Header";


function App() {
  return (
<UserProvider>

<div>
<Header />
  <MainForm 
  leftContent={<LeftColumnContent />}
  rightContent={<RightColumnContent />}/>
</div>
  </UserProvider>
  ); 
}

export default App;
