import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SnackbarProvider } from 'notistack';

ReactDOM.createRoot(document.getElementById("root")).render(
  <Router>
    <AuthProvider>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
        <App />
      </SnackbarProvider>
    </AuthProvider>
  </Router>
);