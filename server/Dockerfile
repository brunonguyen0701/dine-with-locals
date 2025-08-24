# Build stage
FROM node:alpine3.18 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Production stage
FROM node:alpine3.18 AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy built application and production node_modules from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Expose the port
EXPOSE 4000

# Start the application
CMD ["node", "dist/app.js"]