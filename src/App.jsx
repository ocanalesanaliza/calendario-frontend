import { BrowserRouter,Routes,Route } from "react-router-dom";
import LoginPage from "./features/auth/pages/LoginPage";
import CalendarPage from "./features/calendar/pages/CalendarPage";
function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/Login" element={<LoginPage/>}/>
    </Routes>
    </BrowserRouter>
  )
}

export default App