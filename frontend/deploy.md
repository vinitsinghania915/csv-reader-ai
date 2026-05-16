# Application
name: csv-reader-ai-web
language: node
runtime: node-20

# Environments
- name: production
  production: true
- name: staging
  production: false

# Networking
# No custom domain at MVP — Avakal will issue a platform URL.
# Add `ingress.domain` + `tls: lets_encrypt` when you're ready to cut over.

# Dependencies
# (none — stateless Next.js SSR; talks to csv-reader-ai-backend over HTTP.)

# Pre-deploy
# (none — `next build` runs at image-build time inside the Dockerfile,
#  not as a deploy-time step.)

# Health
endpoint: /
expect_status: 200

# Attribution
application:    llm
environments:   llm
ingress:        llm
dependencies:   llm
predeploy:      llm
compliance:     llm
health:         llm
