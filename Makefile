.PHONY: help start dep lint

help:
	@echo "Usage: make [target]"
	@echo
	@echo "Targets:"
	@echo "  help    Show this help message"
	@echo "  start   Start the application"
	@echo "  dep     Check dependencies status"
	@echo "  lint    Lint the code"

start:
	@echo "Starting the application..."
	npm install

dep:
	@echo "Dependencies status:"
	npx depkit

lint:
	@echo "Running linters..."
	npx lintrc
