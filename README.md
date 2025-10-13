# ITServiceAgent

# **Pre-requisites**

### **1. Create a ServiceNow Developer Instance**

*   Sign up at <https://developer.servicenow.com/>.
*   Provision a new instance.
*   Save **admin username** and **password** securely.

***

### **2. Register OAuth in ServiceNow**

*   Navigate to:  
    **System OAuth → Application Registry → New → Create OAuth API endpoint for external clients**
*   Fill in:
    *   **Name:** Copilot (or your chosen name)
    *   **Redirect URL:**  
        `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`
*   Save and note:
    *   **Client ID**
    *   **Client Secret**

***

### **3. Create OAuth Client Registration in Teams Developer Center**

*   Go to <https://dev.teams.microsoft.com>.
*   Register a new OAuth client:
    *   **Base URL:**  
        `https://<your-instance>.service-now.com`
    *   **Auth Endpoint:**  
        `https://<your-instance>.service-now.com/oauth_auth.do`
    *   **Token & Refresh Endpoint:**  
        `https://<your-instance>.service-now.com/oauth_token.do`
*   Enter:
    *   **Client ID** and **Client Secret** from Step 2.
*   Save and note:
    *   **OAuth Client Registration ID**

***

✅ Replace `<your-instance>` with the instance name you created.  
✅ Keep all credentials secure.

***


