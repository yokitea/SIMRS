.PHONY: test test-race build clean up

test:
	go test -v ./...

test-race:
	go test -race -v ./...

build:
	mkdir -p bin
	go build -o bin/simrs-api ./services/simrs-api/cmd/server

clean:
	rm -rf bin

up:
	docker compose -f deploy/docker-compose.yml up -d --build
