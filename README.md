# ITServiceAgent

This code project contains all required files to deploy a declarative agent for Microsoft 365 Copilot that demonstrates integration with ServiceNow.
The scope of the ServiceNow integration comprises:
a) Copilot Connector for ServiceNow Knowledge (requires setup at admin.microsoft.com)
b) API plugin for ServiceNow focused on incidents and catalog items (requires direct integration via REST APIs)

Follow the instructions below before attempting to use the agent:
1. **Pre-requisites** - recommend you test on a developer instance to get started as you will wish to change some of the Scripted REST API authentication prior to deployment on any real instance.
2. **Install Scripted REST APIs** - create the three operations as a Scripted REST API using the files supplied.
3. **Update agent manifest files** - update ai-plugin and openapi-final.yml to use your instance and path details.

Note that the agent uses OAuth2.0 **authorization code** flow to authenticate the user for the REST APIs. For testing, use a developer instance and admin account. When challenged to enter your username and password by the agent use the admin account details. This will happen the first time you run an operation that requires a REST API, and thereafter when your access token expires and needs to be renewed. 

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

## Install Scripted REST APIs

### Steps:

1.  **Create a New Scripted REST API**
    *   Navigate to: **System Web Services → Scripted REST APIs → New**
    *   Enter:
        *   **Name:** `CustomOrder`
        *   **API ID:** `customorderagent`
    *   Click **Submit**.

2.  **Add Resources (Operations)**

    *   Open the newly created API and click **New Resource** for each operation:

    **Resource 1:**

    *   **HTTP Method:** `GET`
    *   **Resource Path:** `/catalog/variables/{sys_id}`
    *   Paste JavaScript from `catalog-variables-{sys_id}.js` (from `scriptedRestApis` folder).
    *   Click **Submit**.

    **Resource 2:**

    *   **HTTP Method:** `POST`
    *   **Resource Path:** `/catalog/reference/lookup`
    *   Paste JavaScript from `catalog-reference-lookup.js`.
    *   Click **Submit**.

    **Resource 3:**

    *   **HTTP Method:** `POST`
    *   **Resource Path:** `/catalog/orders`
    *   Paste JavaScript from `catalog-orders.js`.
    *   Click **Submit**.

3.  **Save and Note Base API Path**
    *   Click **Update** to save the Scripted REST API.
    *   Locate **Base API Path** (top-right of the API form).
    *   **Record this value** — it will be required for the next step.

***


