# Makefile for App
# Run all commands from the project root

.PHONY: help install start start-backend start-frontend dstart dstop clean

# Default target - show help
help:
	@echo "========================================"
	@echo "  App - Available Commands"
	@echo "========================================"
	@echo "Quick Start:"
	@echo "  make install        - Install all dependencies (run once)"
	@echo "  make start          - Start the application (backend and frontend)"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make dstart         - Start containers"
	@echo "  make dstop          - Stop containers"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make clean          - Clean generated files and caches"
	@echo ""

install:
	@echo "📦 Installing dependencies..."
	@echo ""
	@echo "Setting up Python backend with uv..."
	cd backend && uv sync
	@echo ""
	@echo "Installing frontend npm dependencies..."
	cd frontend && npm install
	@echo ""
	@echo "✅ Installation complete!"
	@echo ""
	@echo "Next step: Run 'make start' to launch the app"

start:
	@echo "🚀 Starting application..."
	make -j 2 start-backend start-frontend

start-backend:
	@echo "🚀 Starting backend..."
	cd backend/src && uv run main.py

start-frontend:
	@echo "🚀 Starting frontend..."
	cd frontend && npm run dev

dstart:
	@echo "Checking if Docker is running..."
	@docker version > /dev/null 2>&1 || (echo "Docker is not running. Please start Docker." && exit 1)
	@echo "Docker is running."
	@echo ""
	@echo "🐳 Starting Docker containers..."
	@echo ""
	docker compose up -d

dstop:
	docker compose down

clean:
	@echo "🧹 Cleaning project..."
	rm -rf backend/.venv
	rm -rf frontend/node_modules
	rm -rf frontend/dist
	rm -rf backend/__pycache__
	@echo "✅ Cleanup complete!"
