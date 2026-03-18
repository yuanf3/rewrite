import { ReactKeycloakProvider } from "@react-keycloak/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import keycloak from "@/auth/keycloak";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";

const initOptions = { onLoad: "login-required", pkceMethod: "S256" };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={initOptions}
      LoadingComponent={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <ThemeProvider defaultTheme="dark" disableTransitionOnChange={false}>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ThemeProvider>
    </ReactKeycloakProvider>
  </StrictMode>
);
