FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY pkg ./pkg
COPY services ./services
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/simrs-api ./services/simrs-api/cmd/server

FROM alpine:3.21
RUN adduser -D -u 10001 simrs
COPY --from=builder /out/simrs-api /usr/local/bin/simrs-api
USER 10001
EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/simrs-api"]
