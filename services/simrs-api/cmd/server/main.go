package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yokitea/SIMRS/pkg/hl7client"
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

	jwtSecret := envOr("JWT_SECRET", "changeme_simrs_jwt_secret")
	if os.Getenv("DATABASE_URL") != "" && (jwtSecret == "changeme_simrs_jwt_secret" || len(jwtSecret) < 32) {
		log.Fatalf("[simrs-api] SECURITY: JWT_SECRET must be set to a non-default string >= 32 chars when DATABASE_URL is configured")
	}

	srv := httpapi.NewServer(httpapi.Config{
		JWTSecret:      jwtSecret,
		SSOSecret:      envOr("SSO_LAUNCH_SECRET", "shared_ihe_swf_sso_secret_32bytes"),
		BrandName:      envOr("BRAND_NAME", "Core SIMRS"),
		HospitalName:   envOr("HOSPITAL_NAME", "RS Digital Indonesia"),
		SatusehatOrgID: envOr("SATUSEHAT_ORG_ID", "10000000"),
		SatusehatEnv:   envOr("SATUSEHAT_ENV", "staging"),
		RISHL7Addr:     envOr("RIS_HL7_ADDR", "127.0.0.1:2575"),
		PACSViewerURL:  envOr("NEXT_PUBLIC_PACS_VIEWER_URL", "http://localhost:3001/viewer"),
	}, repo)

	// Start IHE RAD-28 HL7 v2 MLLP ORU^R01 Receiver (receives finalized radiology reports from Core RIS automatically)
	hl7Port := envOr("SIMRS_HL7_PORT", "2577")
	go func() {
		ln, err := net.Listen("tcp", ":"+hl7Port)
		if err != nil {
			log.Printf("[simrs-api] HL7 MLLP ORU receiver disabled on :%s (%v)", hl7Port, err)
			return
		}
		defer ln.Close()
		log.Printf("[simrs-api] HL7 v2 MLLP ORU^R01 receiver active on TCP :%s (IHE RAD-28)", hl7Port)
		sem := make(chan struct{}, 64)
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			select {
			case sem <- struct{}{}:
				go func(c net.Conn) {
					defer func() { <-sem }()
					hl7client.HandleMLLPConn(c, func(oru hl7client.InboundORU) error {
						err := repo.AttachRadiologyReport(ctx, oru.AccessionNumber, "", oru.ReportStatus, oru.RadiologistName, oru.ReportText)
						if err == nil {
							_ = repo.AppendAudit(ctx, "RIS_HL7", "HL7_ORU_R01", "RME", oru.AccessionNumber, "Auto-attached expertise report from Core RIS")
						}
						return err
					})
				}(conn)
			default:
				_ = conn.Close()
			}
		}
	}()

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
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
