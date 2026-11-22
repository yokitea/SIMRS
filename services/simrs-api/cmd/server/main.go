package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yokitea/SIMRS/pkg/simrsstore"
	"github.com/yokitea/SIMRS/services/simrs-api/internal/httpapi"
)

func main() {
	port := envOr("SIMRS_API_PORT", "8090")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var repo simrsstore.Repository
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		pool, err := pgxpool.New(ctx, dsn)
		if err != nil {
			log.Fatalf("[simrs-api] postgres connect failed: %v", err)
		}
		defer pool.Close()
		repo = simrsstore.NewPostgresStore(pool)
		log.Println("[simrs-api] connected to PostgreSQL")
	} else {
		log.Println("[simrs-api] DATABASE_URL not set; running in standalone pre-seeded memory mode")
		repo = simrsstore.NewMemoryStore()
	}

	srv := httpapi.NewServer(httpapi.Config{
		JWTSecret:      envOr("JWT_SECRET", "changeme_simrs_jwt_secret"),
		BrandName:      envOr("BRAND_NAME", "Core SIMRS"),
		HospitalName:   envOr("HOSPITAL_NAME", "RS Digital Indonesia"),
		SatusehatOrgID: envOr("SATUSEHAT_ORG_ID", "10000000"),
		SatusehatEnv:   envOr("SATUSEHAT_ENV", "staging"),
		RISHL7Addr:     envOr("RIS_HL7_ADDR", "127.0.0.1:2575"),
		PACSViewerURL:  envOr("NEXT_PUBLIC_PACS_VIEWER_URL", "http://localhost:3001/viewer"),
	}, repo)

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[simrs-api] %s listening on HTTP :%s", envOr("BRAND_NAME", "Core SIMRS"), port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[simrs-api] error: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = httpSrv.Shutdown(shutCtx)
	log.Println("[simrs-api] shut down gracefully")
}

func envOr(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
