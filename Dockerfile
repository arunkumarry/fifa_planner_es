# Stage 1: Build the frontend React application
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve the backend and frontend
FROM node:20-alpine
WORKDIR /app

# Copy root package.json and tsconfig.json
COPY package*.json tsconfig.json ./
RUN npm install --legacy-peer-deps

# Copy the backend source
COPY backend/ ./backend/

# Copy the built frontend static assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (Cloud Run uses PORT environment variable, defaults to 8080)
EXPOSE 8080
ENV PORT=8080

# Run the backend Express server
CMD ["npm", "run", "start-backend"]
