# Application
name: csv-reader-ai-backend
language: python
runtime: python-3.12

# Environments
- name: production
  production: true
- name: staging
  production: false

# Networking
# No custom domain at MVP — Avakal will issue a platform URL.
# Add `ingress.domain` + `tls: lets_encrypt` when you're ready to cut over.

# Dependencies
- type: rds.postgres
  version: "16"
  size: db.t4g.micro
  storage_gb: 20
  multi_az: false
# NOTE: app writes parquet files to PARQUET_STORAGE_PATH (local disk in code).
# Object storage (S3) is not in the MVP dependency schema — V1 deferral.
# For MVP: mount a writable volume or accept ephemeral parquets until V1.

# Pre-deploy
# (none — SQLAlchemy `Base.metadata.create_all` runs at startup in main.py.
#  If you later adopt Alembic, add: { name: migrate, command: "alembic upgrade head" })

# Health
endpoint: /health
expect_status: 200

# Attribution
application:    llm
environments:   llm
ingress:        llm
dependencies:   llm
predeploy:      llm
compliance:     llm
health:         llm
