import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8080",
  realm: "chatbot",
  clientId: "chatbot-frontend",
});

export default keycloak;
