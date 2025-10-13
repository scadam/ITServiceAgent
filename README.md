# ITServiceAgent

This code project contains all required files to deploy a declarative agent for Microsoft 365 Copilot that demonstrates integration with ServiceNow.
The scope of the ServiceNow integration comprises:
a) Copilot Connector for ServiceNow Knowledge (requires setup at admin.microsoft.com)
b) API plugin for ServiceNow focused on incidents and catalog items (requires direct integration via REST APIs)

Follow the instructions below before attempting to use the agent:
1. **Pre-requisites** - recommend you test on a developer instance to get started as you will wish to change some of the Scripted REST API authentication prior to deployment on any real instance.
2. **Install Scripted REST APIs** - create the three operations as a Scripted REST API using the files supplied.
3. **Setup Copilot Connector for ServiceNow knowledge** - setup the Copilot Connector to provide a semantic index of all SNOW knowledge articles. 
4. **Update agent manifest files** - update decarativeagent, ai-plugin, openapi-final.yml and .env.dev to use your details.

Note that the agent uses OAuth2.0 **authorization code** flow to authenticate the user for the REST APIs. For testing, use a developer instance and admin account. When challenged to enter your username and password by the agent use the admin account details. This will happen the first time you run an operation that requires a REST API, and thereafter when your access token expires and needs to be renewed. 


***

# ServiceNow & Copilot Integration Setup

## 1. Pre-requisites

1.  **Create ServiceNow Developer Instance**
    *   Sign up at <https://developer.servicenow.com/>.
    *   Provision a new instance.
    *   Save **admin username** and **password** securely.

2.  **Register OAuth in ServiceNow**
    *   Navigate: `System OAuth → Application Registry → New → Create OAuth API endpoint for external clients`.
    *   Fill in:
        *   **Name**: Copilot (or chosen name)
        *   **Redirect URL**: `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`
    *   Save and note:
        *   **Client ID**
        *   **Client Secret**

3.  **Create OAuth Client Registration in Teams Developer Center**
    *   Go to <https://dev.teams.microsoft.com>.
    *   Register new OAuth client:
        *   **Base URL**: `https://<your-instance>.service-now.com`
        *   **Auth Endpoint**: `/oauth_auth.do`
        *   **Token & Refresh Endpoint**: `/oauth_token.do`
    *   Enter **Client ID** and **Client Secret** from Step 2.
    *   Save and note **OAuth Client Registration ID**.

***

## 2. Install Scripted REST APIs

1.  **Create New Scripted REST API**
    *   Navigate: `System Web Services → Scripted REST APIs → New`.
    *   Enter:
        *   **Name**: `CustomOrder`
        *   **API ID**: `customorderagent`
    *   Click **Submit**.

2.  **Add Resources (Operations)**
    *   Resource 1:
        *   **Method**: `GET`
        *   **Path**: `/catalog/variables/{sys_id}`
        *   Paste JavaScript from `catalog-variables-sys_id.js`.
    *   Resource 2:
        *   **Method**: `POST`
        *   **Path**: `/catalog/reference/lookup`
        *   Paste JavaScript from `catalog-reference-lookup.js`.
    *   Resource 3:
        *   **Method**: `POST`
        *   **Path**: `/catalog/orders`
        *   Paste JavaScript from `catalog-orders.js`.
     
        *   **NOTE** This script uses RESTV2 calls and therefore uses an identity embedded in the script. I am using basic auth for demo. You will need to add the user and pass in this script. You will see the script uses "admin" and "<pwd>" as a placeholder. When you deploy this 'for real' you will use managed credentials.

3.  **Save and Note Base API Path**
    *   Click **Update**.
    *   Record **Base API Path** (top-right of API form).

***

## 3. Set Up Copilot Connector for ServiceNow Knowledge

1.  **Log into Microsoft 365 Admin Console**
    *   Go to <https://admin.microsoft.com>.
    *   Sign in with **Search Administrator** or higher permissions.

2.  **Configure Copilot Connector**
    *   Navigate: `Settings → Search & Intelligence → Data Connectors`.
    *   Select **Add Connector** → choose **ServiceNow Knowledge**.
    *   Follow prompts:
        *   Provide ServiceNow instance details.
        *   Authenticate using OAuth credentials.
        *   Assign appropriate permissions for indexing knowledge articles.
    *   Reference: <https://learn.microsoft.com/microsoftsearch/servicenow-connector>.

***

## 4. Update Agent Manifest & OpenAPI Specification

### **Update/add `.env.dev`**

**Add Environment Variable**
   - In your project, locate the `env` folder.
   - Add a new file named:  
     `.env.dev`
   - Define the following variable inside the file:  
     ```
     APP_VERSION=1.0.0
     ```
   - **Purpose:** This variable controls the package name created during the provisioning step.  
     Changing this will result in a new build/package file being created as opposed to over-writing the prior file with the same name.


### **Update `declarativeagent.json`**

**Update Declarative Agent Configuration**
   - Open `declarativeagent.json`.
   - Ensure the `capabilities` section includes the Copilot Connector reference:
     ```json
     "capabilities": [
       {
         "name": "People"
       },
       {
         "name": "CodeInterpreter"
       },
       {
         "name": "GraphConnectors",
         "connections": [
           {
             "connection_id": "<YOUR_COPILOT_CONNECTOR_ID>"
           }
         ]
       }
     ]
     ```
   - Replace `<YOUR_COPILOT_CONNECTOR_ID>` with the **ID of the Copilot Connector** created in Step 2.


### **Update `ai-plugin.json`**

```json
{
  "reference_id": "<OAuth Client Registration ID>",
  "runtimes": {
    "type": "OpenApi",
    "auth": "OAuthPluginVault",
    "reference_id": "<OAuth Client Registration ID>"
  },
  "spec_url": "apiSpecificationFile/openapi-final.yaml",
  "run_for_functions": [
    "getAllCatalogItems",
    "createItemOrder",
    "lookupReferenceChoices",
    "placeCatalogOrder",
    "createIncident",
    "getIncidents",
    "getIncidentDetails",
    "updateIncident",
    "getAllUserGroups",
    "getServiceCatalogTasks"
  ]
}
```

### **Update `openapi-final.yaml`**

*   **Servers Section**:

```yaml
servers:
  - url: https://<your-instance>.service-now.com/api
    description: ServiceNow API Server
```

*   Update **paths** using **Base API Path** from Step 2:

```yaml
/<baseApiPath>/catalog/variables/{sys_id}:
  ...
/<baseApiPath>/catalog/reference/lookup:
  ...
/<baseApiPath>/catalog/orders:
  ...
```

*   **Security Schemes**:

```yaml
securitySchemes:
  OAuth2:
    type: oauth2
    flows:
      authorizationCode:
        authorizationUrl: https://<your-instance>.service-now.com/oauth_auth.do
        tokenUrl: https://<your-instance>.service-now.com/oauth_token.do
        refreshUrl: https://<your-instance>.service-now.com/oauth_token.do
        scopes: {}
```

> **Important**: Replace `<your-instance>` with your ServiceNow instance name. Keep credentials secure and do not hardcode secrets.

***

