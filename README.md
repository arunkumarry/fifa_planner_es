# ⚽ FIFA 2026 Match Day AI Planner & Dashboard

A premium, cyber-neon full-stack dashboard designed for FIFA 2026 World Cup fan services. It orchestrates a Google Gemini 2.5 Flash agent with a remote/hosted Elasticsearch Model Context Protocol (MCP) server to provide real-time matchups, weather patterns, seating ticket info, hotel booking, and emergency medical services.

---

## 🛠️ Technology Stack

### **Frontend**
* **React + Vite + TypeScript**: Core frontend framework for a highly responsive single-page application.
* **Vanilla CSS**: Premium styling with cyber-neon gradients, drop shadows, glassmorphism cards, and customized layouts.
* **Lucide React Icons**: Vector iconography for dashboards and chat panels.
* **Dynamic Animations**: Custom SVG rotating vector football animated with continuous linear spin matching the cyberpunk theme.

### **Backend**
* **Express.js + TypeScript**: Light and modular REST server serving both the REST APIs and static build files from the React frontend.
* **Google Gen AI SDK (`@google/genai`)**: Interfacing with the standard Gemini Developer API.
* **Model Context Protocol SDK (`@modelcontextprotocol/sdk`)**: Communicating over Stdio transport with remote MCP servers.
* **Elasticsearch Node SDK (`@elastic/elasticsearch`)**: Direct client to perform geo-distance searches locally.

### **Database & AI Engine**
* **Google Gemini 2.5 Flash**: State-of-the-art model for chat and function-calling/tool use.
* **Elasticsearch Serverless (Elastic Cloud)**: Multi-index backend storing match schedules, stadium details, accommodations, weather forecast data, and emergency hospitals.
* **Elastic Agent Builder (Kibana MCP)**: Built-in hosted MCP endpoint to expose indices and ES|QL search tools directly to the agent.

---

## 🏗️ Implementation Details

### **1. Unified SDK & Endpoint Isolation**
To support standard developer API keys, the client initializes the unified Gen AI SDK with Vertex AI explicitly disabled (`vertexai: false`). This guarantees that all model calls bypass Google Cloud environment overrides and route correctly to `generativelanguage.googleapis.com` (AI Studio).

### **2. Stdio Security & API Key Redaction**
When connecting to the remote Kibana Agent Builder MCP server via `mcp-remote`, the backend captures the standard error (`stderr`) stream of the proxy client. It scans and logs the output in real time while dynamically masking any custom API keys in the Authorization header (`ApiKey [REDACTED]`) to prevent secrets leaking in console stdout logs.

### **3. Dynamic Schema Mapping**
The backend translates MCP tools into Gemini-compatible `FunctionDeclarations` on the fly. It includes a recursive mapper (`mapProperty`) to gracefully resolve complex schemas (such as `anyOf` parameters, nested objects, and arrays with required `items` structures) into Gemini's JSON schema constraints.

### **4. Local Geo-Distance Fallback Routing**
Because the remote hosted MCP server exposes parameterless tools for hotels and completely lacks a hospital lookup tool:
* **Hospitals**: Calls to `find_nearby_hospitals` are intercepted and queried locally using the Elasticsearch client against the `fifa_hospitals` index.
* **Accommodations**: Calls to `find_nearby_accommodations` are routed locally to perform a `geo_distance` search against `fifa_accommodations`, sorting results by proximity to the active match day coordinates.

---

## 🚀 How to Run Locally

### **1. Prerequisites**
Ensure you have the following installed on your machine:
* **Node.js** (v18 or higher)
* **npm** (v9 or higher)

### **2. Setup Environment Variables**
Create a `.env` file in the root directory and add the following keys:
```env
# Gemini API Key (AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# Elasticsearch Serverless Credentials (Elastic Cloud)
ELASTICSEARCH_URL=https://your-elasticsearch-project.es.us-central1.gcp.elastic.cloud:443
ELASTICSEARCH_API_KEY=your_elasticsearch_api_key_here

# Google Cloud variables (used for other cloud integrations if needed)
GOOGLE_CLOUD_PROJECT=local-sprite-498213-u2
GOOGLE_CLOUD_LOCATION=global
```

### **3. Build the Frontend**
Compile the React frontend to build static files:
```bash
# Navigate to the frontend directory
cd frontend

# Install frontend dependencies
npm install

# Build static files
npm run build

# Return to root directory
cd ..
```

### **4. Build the Backend**
Compile TypeScript backend files:
```bash
# Install backend dependencies in root
npm install

# Compile TypeScript
npm run build
```

### **5. Start the Fullstack Server**
Start the backend Express server, which will initialize the MCP connection, load remote tools, and serve the compiled frontend:
```bash
npx ts-node backend/server.ts
```

Open your browser and navigate to:
👉 **[http://localhost:3001](http://localhost:3001)**

---

## 🗣️ Things to Try in Chat
The AI is fully contextualized to your active matchup. Select a match day from the dropdown, then ask:
1. *"Where should I stay? Find hotels near the stadium."* (Performs geo-distance search for hotels near the active venue).
2. *"Is there a hospital nearby in case of an emergency?"* (Locates the closest medical centers).
3. *"Who is predicted to win this match?"* (Performs pre-match analytics lookup and prediction).
